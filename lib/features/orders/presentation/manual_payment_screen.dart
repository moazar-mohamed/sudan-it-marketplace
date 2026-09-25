import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../companies/domain/entities/payment_account.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../../core/services/receipt_image_compressor.dart';
import '../../../core/widgets/image_picker_strings.dart';
import '../domain/entities/checkout_order_draft.dart';
import '../domain/entities/order_receipt.dart';
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

  String _formatPrice(double price) {
    final parts = price.toStringAsFixed(0).split('.');
    final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return parts[0].replaceAllMapped(regExp, (Match m) => '${m[1]},');
  }

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
            customerName: widget.draft.customerName,
            receipt: _receipt,
            deliveryLatitude: widget.draft.deliveryLatitude,
            deliveryLongitude: widget.draft.deliveryLongitude,
          );

      if (!mounted) return;
      if (order != null) {
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
    final paymentAccounts =
        ref
            .watch(resolvedCompanyProvider(widget.draft.companyId))
            ?.paymentAccounts ??
        const <PaymentAccount>[];
    // Until the company has loaded, its accounts are unknown, not missing.
    final accountsLoading =
        paymentAccounts.isEmpty &&
        ref.watch(companyStreamProvider(widget.draft.companyId)).isLoading;
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(title: Text(l10n.paymentTitle)),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.fromLTRB(
            margin,
            AppSpacing.s16,
            margin,
            MediaQuery.viewInsetsOf(context).bottom + AppSpacing.s24,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 1. Amount to transfer.
                  AppCard(
                    color: AppColors.brandPrimarySubtle,
                    borderColor: AppColors.brandPrimarySubtleStrong,
                    padding: const EdgeInsets.all(AppSpacing.s16),
                    child: Column(
                      children: [
                        Text(
                          l10n.paymentAmountToTransfer,
                          style: AppTextStyles.bodyStrong.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.s4),
                        Text(
                          '${_formatPrice(widget.draft.totalAmount)} SDG',
                          style: AppTextStyles.stat.copyWith(
                            color: AppColors.textBrand,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.s4),
                        Text(
                          l10n.paymentOrderCreatedAfter,
                          textAlign: TextAlign.center,
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s16),

                  // 2. What to do outside the app.
                  AppBanner(
                    tone: AppTone.info,
                    message: l10n.paymentInstructions,
                  ),
                  const SizedBox(height: AppSpacing.s20),

                  // 3. The accounts of the order's own company.
                  Text(l10n.paymentAccounts, style: AppTextStyles.h3),
                  const SizedBox(height: AppSpacing.s8),
                  if (accountsLoading)
                    const AppLoadingState()
                  else if (paymentAccounts.isEmpty)
                    AppBanner(
                      tone: AppTone.error,
                      message: l10n.paymentNoAccountsForCompany,
                    )
                  else
                    for (final account in paymentAccounts) ...[
                      _buildAccountCard(
                        context: context,
                        bankName: account.bankName,
                        accountName: account.accountName,
                        accountNumber: account.accountNumber,
                        phoneNumber: account.phoneNumber,
                      ),
                      const SizedBox(height: AppSpacing.s12),
                    ],
                  const SizedBox(height: AppSpacing.s12),

                  // 4. Upload the receipt.
                  Text(l10n.paymentUploadReceipt, style: AppTextStyles.h3),
                  const SizedBox(height: AppSpacing.s4),
                  Text(
                    l10n.paymentUploadHint,
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s12),
                  if (_receiptMissing) ...[
                    AppBanner(
                      tone: AppTone.error,
                      message: l10n.paymentReceiptRequired,
                    ),
                    const SizedBox(height: AppSpacing.s12),
                  ],
                  if (_receipt == null)
                    _buildUploadTrigger(context)
                  else
                    _buildReceiptPreview(context),
                  const SizedBox(height: AppSpacing.s16),

                  AppBanner(
                    tone: AppTone.warning,
                    icon: Icons.access_time_rounded,
                    message: l10n.paymentPendingNote,
                  ),
                  const SizedBox(height: AppSpacing.s24),

                  // 5. Submit.
                  AppButton.primary(
                    label: _isSubmitting
                        ? l10n.paymentSubmitting
                        : l10n.paymentSubmit,
                    icon: Icons.check_circle_outline,
                    loading: _isSubmitting,
                    expand: true,
                    onPressed: paymentAccounts.isEmpty || _preparing
                        ? null
                        : _onSubmitReceipt,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildUploadTrigger(BuildContext context) {
    return AppCard(
      onTap: _onPickReceipt,
      borderColor: AppColors.primary,
      borderWidth: AppBorder.thick,
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.s24,
        horizontal: AppSpacing.s16,
      ),
      child: Column(
        children: [
          if (_preparing)
            const AppSpinner(size: 32, strokeWidth: 3)
          else
            const AppIconTile(
              icon: Icons.cloud_upload_outlined,
              size: 52,
              radius: AppRadius.full,
            ),
          const SizedBox(height: AppSpacing.s12),
          if (_preparing)
            Text(
              context.l10n.receiptPreparing,
              style: AppTextStyles.bodyStrong.copyWith(
                color: AppColors.textBrand,
              ),
            )
          else
            Text(
              context.l10n.paymentTapToUpload,
              style: AppTextStyles.bodyStrong.copyWith(
                color: AppColors.textBrand,
              ),
            ),
          Text(
            context.l10n.paymentSupports,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReceiptPreview(BuildContext context) {
    final l10n = context.l10n;
    return AppCard(
      borderColor: AppColors.success,
      padding: const EdgeInsets.all(AppSpacing.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.check_circle_rounded,
                color: AppColors.success,
                size: AppSize.iconMd,
              ),
              const SizedBox(width: AppSpacing.s6),
              Expanded(
                child: Text(
                  l10n.paymentReceiptSelected,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyStrong.copyWith(
                    color: AppColors.successText,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: _onRemoveReceipt,
                icon: const Icon(Icons.delete_outline, size: AppSize.iconMd),
                label: Text(l10n.commonRemove),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.errorText,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s8),
          // The receipt exactly as it will be stored with the order.
          ClipRRect(
            borderRadius: AppRadius.smAll,
            child: ColoredBox(
              color: AppColors.bgSubtle,
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
          const SizedBox(height: AppSpacing.s8),
          Row(
            children: [
              const Icon(
                Icons.image_outlined,
                size: AppSize.iconMd,
                color: AppColors.iconDefault,
              ),
              const SizedBox(width: AppSpacing.s6),
              Expanded(
                child: Text(
                  '${_receipt!.fileName} (${_formatSize(_receipt!.sizeBytes)})',
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.textSecondary,
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
      ),
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
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const AppIconTile(icon: Icons.account_balance_outlined, size: 36),
              const SizedBox(width: AppSpacing.s12),
              Expanded(child: Text(bankName, style: AppTextStyles.h3)),
            ],
          ),
          const SizedBox(height: AppSpacing.s8),
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
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: KeyValueRow(
            label: label,
            value: value,
            // Numbers stay left-to-right inside an RTL screen.
            valueTextDirection: TextDirection.ltr,
          ),
        ),
        IconButton(
          tooltip: context.l10n.commonCopy,
          onPressed: () => _copyToClipboard(value, copiedLabel),
          icon: const Icon(
            Icons.copy_rounded,
            size: AppSize.iconMd,
            color: AppColors.primary,
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
