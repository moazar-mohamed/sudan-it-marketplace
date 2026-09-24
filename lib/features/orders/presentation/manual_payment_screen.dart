import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../companies/domain/entities/payment_account.dart';
import '../../companies/presentation/companies_providers.dart';
import '../domain/entities/checkout_order_draft.dart';
import 'order_pending_verification_screen.dart';
import 'orders_controller.dart';
import '../../../core/localization/l10n_extension.dart';

class ManualPaymentScreen extends ConsumerStatefulWidget {
  const ManualPaymentScreen({
    super.key,
    required this.draft,
  });

  final CheckoutOrderDraft draft;

  @override
  ConsumerState<ManualPaymentScreen> createState() => _ManualPaymentScreenState();
}

class _ManualPaymentScreenState extends ConsumerState<ManualPaymentScreen> {
  String? _selectedReceiptName;
  String? _selectedReceiptSize;
  bool _receiptMissing = false;
  bool _isSubmitting = false;

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

  void _onPickReceipt() {
    setState(() {
      _selectedReceiptName = 'bankak_receipt_${widget.draft.productId.toLowerCase()}.jpg';
      _selectedReceiptSize = '428 KB';
      _receiptMissing = false;
    });
  }

  void _onRemoveReceipt() {
    setState(() {
      _selectedReceiptName = null;
      _selectedReceiptSize = null;
    });
  }

  Future<void> _onSubmitReceipt() async {
    if (_selectedReceiptName == null) {
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
            receiptFileName: _selectedReceiptName!,
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
    final paymentAccounts = ref
            .watch(resolvedCompanyProvider(widget.draft.companyId))
            ?.paymentAccounts ??
        const <PaymentAccount>[];
    // Until the company has loaded, its accounts are unknown, not missing.
    final accountsLoading = paymentAccounts.isEmpty &&
        ref.watch(companyStreamProvider(widget.draft.companyId)).isLoading;
    // The payment goes to the order's own company, never to the marketplace.
    final firstHolder =
        paymentAccounts.isEmpty ? '' : paymentAccounts.first.accountName.trim();
    final beneficiary =
        firstHolder.isNotEmpty ? firstHolder : widget.draft.companyName;
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        title: Text(l10n.paymentTitle),
      ),
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
                          style: AppTextStyles.bodyStrong
                              .copyWith(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: AppSpacing.s4),
                        Text(
                          '${_formatPrice(widget.draft.totalAmount)} SDG',
                          style: AppTextStyles.stat
                              .copyWith(color: AppColors.textBrand),
                        ),
                        const SizedBox(height: AppSpacing.s4),
                        Text(
                          l10n.paymentOrderCreatedAfter,
                          textAlign: TextAlign.center,
                          style: AppTextStyles.caption
                              .copyWith(color: AppColors.textSecondary),
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
                    style: AppTextStyles.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: AppSpacing.s12),
                  if (_receiptMissing) ...[
                    AppBanner(
                      tone: AppTone.error,
                      message: l10n.paymentReceiptRequired,
                    ),
                    const SizedBox(height: AppSpacing.s12),
                  ],
                  if (_selectedReceiptName == null)
                    _buildUploadTrigger(context)
                  else
                    _buildReceiptPreview(context, beneficiary),
                  const SizedBox(height: AppSpacing.s16),

                  AppBanner(
                    tone: AppTone.warning,
                    icon: Icons.access_time_rounded,
                    message: l10n.paymentPendingNote,
                  ),
                  const SizedBox(height: AppSpacing.s24),

                  // 5. Submit.
                  AppButton.primary(
                    label: _isSubmitting ? l10n.paymentSubmitting : l10n.paymentSubmit,
                    icon: Icons.check_circle_outline,
                    loading: _isSubmitting,
                    expand: true,
                    onPressed: paymentAccounts.isEmpty ? null : _onSubmitReceipt,
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
          const AppIconTile(
            icon: Icons.cloud_upload_outlined,
            size: 52,
            radius: AppRadius.full,
          ),
          const SizedBox(height: AppSpacing.s12),
          Text(
            context.l10n.paymentTapToUpload,
            style: AppTextStyles.bodyStrong
                .copyWith(color: AppColors.textBrand),
          ),
          Text(
            context.l10n.paymentSupports,
            style: AppTextStyles.caption
                .copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildReceiptPreview(BuildContext context, String beneficiary) {
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
                  style: AppTextStyles.bodyStrong
                      .copyWith(color: AppColors.successText),
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
          // Summary of the slip the customer is about to submit.
          AppCard(
            color: AppColors.bgSubtle,
            padding: const EdgeInsets.all(AppSpacing.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const AppIconTile(
                      icon: Icons.receipt_long,
                      tone: AppTone.success,
                      size: 32,
                      radius: AppRadius.full,
                    ),
                    const SizedBox(width: AppSpacing.s8),
                    Expanded(
                      child: Text(
                        l10n.paymentSlipPreview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.labelSmall
                            .copyWith(color: AppColors.textSecondary),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.s8),
                    StatusChip(
                      label: l10n.paymentSlipCompleted,
                      tone: AppTone.success,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.s12),
                Text(
                  l10n.paymentSlipAmount(_formatPrice(widget.draft.totalAmount)),
                  style: AppTextStyles.h3,
                ),
                Text(
                  l10n.paymentSlipBeneficiary(beneficiary),
                  style: AppTextStyles.caption
                      .copyWith(color: AppColors.textPrimary),
                ),
                Text(
                  l10n.paymentSlipRef(widget.draft.productId.toUpperCase()),
                  style: AppTextStyles.caption
                      .copyWith(color: AppColors.textSecondary),
                ),
              ],
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
                  '$_selectedReceiptName ($_selectedReceiptSize)',
                  style: AppTextStyles.caption
                      .copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              TextButton(
                onPressed: _onPickReceipt,
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
              const AppIconTile(
                icon: Icons.account_balance_outlined,
                size: 36,
              ),
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
