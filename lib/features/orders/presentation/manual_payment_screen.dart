import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(context.l10n.paymentCopied(label)),
        duration: const Duration(seconds: 2),
      ),
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: AppColors.error,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.l10n.paymentSubmitFailed),
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
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

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        title: Text(context.l10n.paymentTitle),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.fromLTRB(
            16,
            16,
            16,
            MediaQuery.viewInsetsOf(context).bottom + 28,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
            // 1. Amount to Transfer Header Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                children: [
                  Text(
                    context.l10n.paymentAmountToTransfer,
                    style: textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.7),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${_formatPrice(widget.draft.totalAmount)} SDG',
                    style: textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    context.l10n.paymentOrderCreatedAfter,
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // 2. Clear External Transfer Instructions
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: colorScheme.onSurface.withValues(alpha: 0.08),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    color: AppColors.primary,
                    size: 22,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      context.l10n.paymentInstructions,
                      style: textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurface.withValues(alpha: 0.85),
                        height: 1.45,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // 3. Payment Account Details Card
            Text(
              context.l10n.paymentAccounts,
              style: textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 10),

            // The accounts the order's own company added in its profile.
            if (accountsLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (paymentAccounts.isEmpty)
              _buildNoAccountsNotice(context)
            else
              for (final account in paymentAccounts) ...[
                _buildAccountCard(
                  context: context,
                  bankName: account.bankName,
                  accountName: account.accountName,
                  accountNumber: account.accountNumber,
                  phoneNumber: account.phoneNumber,
                  icon: Icons.account_balance_outlined,
                ),
                const SizedBox(height: 10),
              ],
            const SizedBox(height: 24),

            // 4. Upload Receipt Section
            Text(
              context.l10n.paymentUploadReceipt,
              style: textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              context.l10n.paymentUploadHint,
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurface.withValues(alpha: 0.65),
              ),
            ),
            const SizedBox(height: 12),

            // Validation Warning Message
            if (_receiptMissing) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AppColors.error.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.error_outline_rounded,
                      color: AppColors.error,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        context.l10n.paymentReceiptRequired,
                        style: textTheme.bodySmall?.copyWith(
                          color: AppColors.error,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Receipt Box: Either Upload Trigger or Receipt Preview
            if (_selectedReceiptName == null) ...[
              // Upload Trigger Box
              InkWell(
                onTap: _onPickReceipt,
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    vertical: 28,
                    horizontal: 16,
                  ),
                  decoration: BoxDecoration(
                    color: colorScheme.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.4),
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.cloud_upload_outlined,
                          color: AppColors.primary,
                          size: 28,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        context.l10n.paymentTapToUpload,
                        style: textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        context.l10n.paymentSupports,
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurface.withValues(alpha: 0.55),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ] else ...[
              // Receipt Preview Container (Shows the selected receipt image before submission)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: AppColors.success.withValues(alpha: 0.4),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.check_circle_rounded,
                          color: AppColors.success,
                          size: 18,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            context.l10n.paymentReceiptSelected,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.labelLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.success,
                            ),
                          ),
                        ),
                        TextButton.icon(
                          onPressed: _onRemoveReceipt,
                          icon: const Icon(Icons.delete_outline, size: 16),
                          label: Text(context.l10n.commonRemove),
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.error,
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Visual Receipt Graphic
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: Colors.green.shade100,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.receipt_long,
                                  color: Colors.green.shade800,
                                  size: 18,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  context.l10n.paymentSlipPreview,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: textTheme.labelSmall?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: Colors.grey.shade700,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.green.shade100,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  context.l10n.paymentSlipCompleted,
                                  style: textTheme.labelSmall?.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: Colors.green.shade800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            context.l10n.paymentSlipAmount(_formatPrice(widget.draft.totalAmount)),
                            style: textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            context.l10n.paymentSlipBeneficiary(beneficiary),
                            style: textTheme.bodySmall?.copyWith(
                              color: Colors.grey.shade800,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          Text(
                            context.l10n.paymentSlipRef(widget.draft.productId.toUpperCase()),
                            style: textTheme.bodySmall?.copyWith(
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),

                    // File Meta Row
                    Row(
                      children: [
                        Icon(
                          Icons.image_outlined,
                          size: 18,
                          color: colorScheme.onSurface.withValues(alpha: 0.6),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '$_selectedReceiptName ($_selectedReceiptSize)',
                            style: textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurface.withValues(alpha: 0.7),
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        TextButton(
                          onPressed: _onPickReceipt,
                          child: Text(context.l10n.paymentReplace),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),

            // Verification Notice
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.shade200),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.access_time_rounded,
                    color: Colors.amber.shade900,
                    size: 18,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      context.l10n.paymentPendingNote,
                      style: textTheme.bodySmall?.copyWith(
                        color: Colors.amber.shade900,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // 5. Submit Receipt Action
            ElevatedButton.icon(
              onPressed: (_isSubmitting || paymentAccounts.isEmpty)
                  ? null
                  : _onSubmitReceipt,
              icon: _isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.onPrimary,
                      ),
                    )
                  : const Icon(Icons.check_circle_outline),
              label: Text(
                _isSubmitting
                    ? context.l10n.paymentSubmitting
                    : context.l10n.paymentSubmit,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAccountCard({
    required BuildContext context,
    required String bankName,
    required String accountName,
    required String accountNumber,
    required String phoneNumber,
    required IconData icon,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: colorScheme.onSurface.withValues(alpha: 0.08),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  bankName,
                  style: textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (accountName.isNotEmpty) ...[
            _buildAccountRow(context.l10n.paymentAccountName, accountName, textTheme, colorScheme),
            const SizedBox(height: 6),
          ],
          _buildCopyableAccountRow(
            label: context.l10n.paymentAccountMban,
            value: accountNumber,
            valueStyle: textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: colorScheme.onSurface,
            ),
            textTheme: textTheme,
            colorScheme: colorScheme,
            onCopy: () => _copyToClipboard(accountNumber, context.l10n.paymentAccountNumberLabel),
          ),
          if (phoneNumber.isNotEmpty) ...[
            const SizedBox(height: 6),
            _buildCopyableAccountRow(
              label: context.l10n.paymentPhoneIdentifier,
              value: phoneNumber,
              valueStyle: textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: colorScheme.onSurface,
              ),
              textTheme: textTheme,
              colorScheme: colorScheme,
              onCopy: () => _copyToClipboard(phoneNumber, context.l10n.paymentPhoneNumberLabel),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildNoAccountsNotice(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.error,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              context.l10n.paymentNoAccountsForCompany,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountRow(
    String label,
    String value,
    TextTheme textTheme,
    ColorScheme colorScheme,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: colorScheme.onSurface,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCopyableAccountRow({
    required String label,
    required String value,
    required TextStyle? valueStyle,
    required TextTheme textTheme,
    required ColorScheme colorScheme,
    required VoidCallback onCopy,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(value, textAlign: TextAlign.end, style: valueStyle),
        ),
        InkWell(
          onTap: onCopy,
          borderRadius: BorderRadius.circular(6),
          child: const Padding(
            padding: EdgeInsets.all(4),
            child: Icon(
              Icons.copy_rounded,
              size: 16,
              color: AppColors.primary,
            ),
          ),
        ),
      ],
    );
  }
}
