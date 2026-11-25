import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/phone_number.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../companies/domain/entities/payment_account.dart';
import '../../cities/presentation/city_providers.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../../core/services/receipt_image_compressor.dart';
import '../../../core/widgets/image_picker_strings.dart';
import '../domain/entities/checkout_order_draft.dart';
import '../domain/entities/order_receipt.dart';
import '../../customer_dashboard/presentation/site/site_detail_parts.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../../customer_dashboard/presentation/site/site_orders.dart';
import 'receipt_picker.dart';
import 'order_pending_verification_screen.dart';
import 'orders_controller.dart';
import '../../../core/localization/l10n_extension.dart';

class ManualPaymentScreen extends ConsumerStatefulWidget {
  const ManualPaymentScreen({super.key, required this.draft});

  final CheckoutOrderDraft draft;

  @override
  ConsumerState<ManualPaymentScreen> createState() =>
      _ManualPaymentScreenState();
}

class _ManualPaymentScreenState extends ConsumerState<ManualPaymentScreen> {
  /// The receipt, already compressed and ready to be stored with the order.
  ReceiptImage? _receipt;

  /// True while a picked image is being compressed.
  bool _preparing = false;
  bool _receiptMissing = false;
  bool _isSubmitting = false;

  String _formatSize(int bytes) => '${(bytes / 1024).round()} KB';

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    showAppSnackBar(
      context,
      context.l10n.paymentCopied(label),
      tone: AppTone.success,
    );
  }

  /// Lets the customer choose the receipt image (gallery or camera), then
  /// shrinks it to a small JPEG. Nothing is stored until the order is placed.
  Future<void> _onPickReceipt() async {
    if (_preparing || _isSubmitting) return;
    final source = await showModalBottomSheet<ReceiptSource>(
      context: context,
      showDragHandle: true,
      builder: (_) => const _ReceiptSourceSheet(),
    );
    if (source == null || !mounted) return;

    setState(() => _preparing = true);
    try {
      final file = await ref.read(receiptPickerProvider)(source);
      if (file == null || !mounted) return; // the picker was dismissed
      final image = await ref
          .read(receiptCompressorProvider)
          .compress(file.bytes, fileName: file.name);
      if (!mounted) return;
      setState(() {
        _receipt = image;
        _receiptMissing = false;
      });
    } on ReceiptPickException catch (error) {
      if (mounted) _showReceiptError(_pickMessage(error.failure));
    } on ReceiptCompressionException catch (error) {
      if (mounted) {
        final l10n = context.l10n;
        _showReceiptError(
          error.error == ReceiptCompressionError.tooLarge
              ? l10n.receiptTooLarge
              : l10n.receiptUnreadable,
        );
      }
    } catch (_) {
      if (mounted) _showReceiptError(ImagePickerStrings.of(context).pickFailed);
    } finally {
      if (mounted) setState(() => _preparing = false);
    }
  }

  String _pickMessage(ReceiptPickFailure failure) {
    final strings = ImagePickerStrings.of(context);
    return switch (failure) {
      ReceiptPickFailure.cameraDenied => strings.cameraDenied,
      ReceiptPickFailure.galleryDenied => strings.galleryDenied,
      ReceiptPickFailure.cameraUnavailable => strings.cameraUnavailable,
      ReceiptPickFailure.unsupported => strings.unsupportedFile,
      ReceiptPickFailure.tooLarge => context.l10n.receiptTooLarge,
      ReceiptPickFailure.failed => strings.pickFailed,
    };
  }

  void _showReceiptError(String message) =>
      showAppSnackBar(context, message, tone: AppTone.error);

  void _onRemoveReceipt() {
    setState(() => _receipt = null);
  }

  Future<void> _onSubmitReceipt() async {
    if (_receipt == null) {
      setState(() {
        _receiptMissing = true;
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _receiptMissing = false;
    });

    try {
      final order = await ref
          .read(ordersControllerProvider.notifier)
          .createOrder(
            orderId: widget.draft.orderId,
            customerId: widget.draft.customerId,
            companyId: widget.draft.companyId,
            companyName: widget.draft.companyName,
            productId: widget.draft.productId,
            productName: widget.draft.productName,
            quantity: widget.draft.quantity,
            unitPrice: widget.draft.unitPrice,
            productSubtotal: widget.draft.productSubtotal,
            installationSelected: widget.draft.installationSelected,
            installationFee: widget.draft.installationFee,
            deliveryFee: widget.draft.deliveryFee,
            totalAmount: widget.draft.totalAmount,
            deliveryAddress: widget.draft.deliveryAddress,
            contactPhone: widget.draft.contactPhone,
            deliveryMethod: widget.draft.deliveryMethod,
            deliveryCityId: widget.draft.deliveryCityId,
            customerName: widget.draft.customerName,
            receipt: _receipt,
            deliveryLatitude: widget.draft.deliveryLatitude,
            deliveryLongitude: widget.draft.deliveryLongitude,
          );

      if (!mounted) return;
      if (order != null) {
        // The next order starts from the customer's own city again.
        ref.read(deliveryCityOverrideProvider.notifier).set(null);
        setState(() => _isSubmitting = false);
        Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => OrderPendingVerificationScreen(order: order),
          ),
        );
        return;
      }

      final orderState = ref.read(ordersControllerProvider);
      final message = orderState is OrderActionError
          ? orderState.message
          : context.l10n.paymentSubmitFailed;
      setState(() => _isSubmitting = false);
      showAppSnackBar(context, message, tone: AppTone.error);
    } catch (error) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      showAppSnackBar(
        context,
        context.l10n.paymentSubmitFailed,
        tone: AppTone.error,
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    // The accounts live in their own document, which only signed-in
    // customers may read (never the public company document).
    final accountsAsync = ref.watch(
      companyPaymentAccountsProvider(widget.draft.companyId),
    );
    final paymentAccounts =
        accountsAsync.asData?.value ?? const <PaymentAccount>[];
    // Until they have loaded, the accounts are unknown, not missing.
    final accountsLoading = paymentAccounts.isEmpty && accountsAsync.isLoading;
    final meta = AppTextStyles.caption.copyWith(
      fontSize: 13,
      color: colors.textSecondary,
    );
    Widget error(String text) => Text(
      text,
      style: AppTextStyles.body.copyWith(fontSize: 14, color: colors.errorText),
    );

    final blocks = <Widget>[
      SitePageTitle(l10n.paymentTitle),

      // 1. Amount to transfer (`.tile.amount`).
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: colors.bgSubtle,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: colors.borderDefault),
        ),
        child: Column(
          children: [
            Text(l10n.paymentAmountToTransfer, style: meta),
            const SizedBox(height: 4),
            Text(
              sitePrice(context, widget.draft.totalAmount),
              textAlign: TextAlign.center,
              style: AppTextStyles.h1.copyWith(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: colors.price,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              l10n.paymentOrderCreatedAfter,
              textAlign: TextAlign.center,
              style: meta,
            ),
          ],
        ),
      ),

      // 2. What to do outside the app.
      SiteNote(
        icon: Icons.inventory_2_outlined,
        title: '',
        message: l10n.paymentInstructions,
      ),

      // 3. The accounts of the order's own company.
      Padding(
        padding: const EdgeInsetsDirectional.only(start: 4, top: 8),
        child: Text(
          l10n.paymentAccounts,
          style: AppTextStyles.bodyStrong.copyWith(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: colors.textSecondary,
          ),
        ),
      ),
      if (accountsLoading)
        const AppLoadingState()
      else if (paymentAccounts.isEmpty)
        error(l10n.paymentNoAccountsForCompany)
      else
        for (final account in paymentAccounts)
          _buildAccountCard(
            context: context,
            bankName: account.bankName,
            accountName: account.accountName,
            accountNumber: account.accountNumber,
            phoneNumber: account.phoneNumber,
          ),

      // 4. Upload the receipt.
      SiteTile(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SiteTileTitle(l10n.paymentUploadReceipt),
            const SizedBox(height: 6),
            SiteProse(l10n.paymentUploadHint),
            const SizedBox(height: 12),
            if (_receipt == null)
              _buildUploadTrigger(context)
            else
              _buildReceiptPreview(context),
          ],
        ),
      ),

      Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: colors.warningSubtle,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          l10n.paymentPendingNote,
          style: AppTextStyles.body.copyWith(
            fontSize: 14,
            height: 1.7,
            color: colors.warningText,
          ),
        ),
      ),
      if (_receiptMissing) error(l10n.paymentReceiptRequired),

      // 5. Submit, or go back to change the order.
      AppButton.primary(
        label: _isSubmitting ? l10n.paymentSubmitting : l10n.paymentSubmit,
        loading: _isSubmitting,
        expand: true,
        onPressed: paymentAccounts.isEmpty || _preparing
            ? null
            : _onSubmitReceipt,
      ),
      AppButton.outlined(
        key: const ValueKey('payment-edit-order'),
        label: l10n.siteEditOrder,
        expand: true,
        onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
      ),
    ];

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.fromLTRB(
            16,
            20,
            16,
            MediaQuery.viewInsetsOf(context).bottom + 48,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < blocks.length; i++) ...[
                    if (i > 0) const SizedBox(height: 16),
                    blocks[i],
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// The dashed box of the site (`.upload`): a 2 px blue line, 18 px corners.
  Widget _buildUploadTrigger(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: colors.textBrand, width: 2),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: _onPickReceipt,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_preparing) ...[
                const AppSpinner(size: 28, strokeWidth: 3),
                const SizedBox(height: 8),
              ],
              Text(
                _preparing
                    ? context.l10n.receiptPreparing
                    : context.l10n.paymentTapToUpload,
                textAlign: TextAlign.center,
                style: AppTextStyles.bodyStrong.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colors.textBrand,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                context.l10n.paymentSupports,
                textAlign: TextAlign.center,
                style: AppTextStyles.caption.copyWith(
                  fontSize: 13,
                  color: colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildReceiptPreview(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.paymentReceiptSelected,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.bodyStrong.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: colors.successText,
                ),
              ),
            ),
            TextButton(
              onPressed: _onRemoveReceipt,
              child: Text(l10n.commonRemove),
            ),
          ],
        ),
        const SizedBox(height: 8),
        // The receipt exactly as it will be stored with the order.
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: ColoredBox(
            color: colors.bgSubtle,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 260),
              child: SizedBox(
                width: double.infinity,
                child: Image.memory(
                  _receipt!.bytes,
                  fit: BoxFit.contain,
                  gaplessPlayback: true,
                  key: const ValueKey('receipt-preview'),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Text(
                '${_receipt!.fileName} (${_formatSize(_receipt!.sizeBytes)})',
                textDirection: TextDirection.ltr,
                style: AppTextStyles.caption.copyWith(
                  fontSize: 13,
                  color: colors.textSecondary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            TextButton(
              onPressed: _preparing ? null : _onPickReceipt,
              child: Text(l10n.paymentReplace),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAccountCard({
    required BuildContext context,
    required String bankName,
    required String accountName,
    required String accountNumber,
    required String phoneNumber,
  }) {
    final l10n = context.l10n;
    return SiteTile(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            bankName,
            style: AppTextStyles.bodyStrong.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          if (accountName.isNotEmpty)
            KeyValueRow(label: l10n.paymentAccountName, value: accountName),
          _copyableRow(
            context,
            label: l10n.paymentAccountMban,
            value: accountNumber,
            copiedLabel: l10n.paymentAccountNumberLabel,
          ),
          if (phoneNumber.isNotEmpty)
            _copyableRow(
              context,
              label: l10n.paymentPhoneIdentifier,
              value: phoneNumber,
              display: displayPhone(phoneNumber),
              copiedLabel: l10n.paymentPhoneNumberLabel,
            ),
        ],
      ),
    );
  }

  /// Account number or phone with a 48 px copy button at the end.
  Widget _copyableRow(
    BuildContext context, {
    required String label,
    required String value,
    required String copiedLabel,
    String? display,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: KeyValueRow(
            label: label,
            value: display ?? value,
            // Numbers stay left-to-right inside an RTL screen.
            valueTextDirection: TextDirection.ltr,
          ),
        ),
        IconButton(
          tooltip: context.l10n.commonCopy,
          onPressed: () => _copyToClipboard(value, copiedLabel),
          icon: Icon(
            Icons.copy_rounded,
            size: AppSize.iconMd,
            color: context.colors.iconBrand,
          ),
        ),
      ],
    );
  }
}

/// "Choose from device" / "Take a photo" for the receipt.
class _ReceiptSourceSheet extends StatelessWidget {
  const _ReceiptSourceSheet();

  @override
  Widget build(BuildContext context) {
    final strings = ImagePickerStrings.of(context);
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: Text(strings.chooseFromDevice),
            onTap: () => Navigator.of(context).pop(ReceiptSource.gallery),
          ),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: Text(strings.takePhoto),
            onTap: () => Navigator.of(context).pop(ReceiptSource.camera),
          ),
          const SizedBox(height: AppSpacing.s8),
        ],
      ),
    );
  }
}
