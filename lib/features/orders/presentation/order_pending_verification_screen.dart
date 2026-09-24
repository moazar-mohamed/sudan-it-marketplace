import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../auth/presentation/auth_gate.dart';
import '../domain/entities/order_entity.dart';
import 'order_details_screen.dart';
import 'widgets/order_location_widgets.dart';
import 'widgets/price_summary_row.dart';
import 'order_labels.dart';
import '../../../core/localization/l10n_extension.dart';

class OrderPendingVerificationScreen extends StatelessWidget {
  const OrderPendingVerificationScreen({super.key, required this.order});

  final OrderEntity order;

  /// Leaves the confirmation for good: the whole checkout flow (product,
  /// checkout, payment) is dropped from the back stack, so no Back press can
  /// return to a finished checkout and submit the same order again. The app
  /// restarts from the [AuthGate] (a later sign-out still reaches the login
  /// screen), on [tab], optionally with [openOrder] on top so Back from its
  /// details lands on the orders list.
  void _leaveCheckout(
    BuildContext context, {
    int tab = 0,
    OrderEntity? openOrder,
  }) {
    final navigator = Navigator.of(context);
    navigator.pushAndRemoveUntil(
      MaterialPageRoute<void>(
        builder: (_) => AuthGate(customerInitialTab: tab),
      ),
      (route) => false,
    );
    if (openOrder != null) {
      navigator.push(
        MaterialPageRoute<void>(
          builder: (_) => OrderDetailsScreen(order: openOrder),
        ),
      );
    }
  }

  String _formatPrice(double price) {
    final parts = price.toStringAsFixed(0).split('.');
    final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return parts[0].replaceAllMapped(regExp, (Match m) => '${m[1]},');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    // The order is already placed: the system Back gesture must not return to
    // the checkout, it goes to the orders list like "View in My Orders".
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leaveCheckout(context, tab: 1);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.orderOrderStatus),
          automaticallyImplyLeading: false,
        ),
        body: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            margin,
            AppSpacing.s20,
            margin,
            AppSpacing.s24,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
              child: Column(
                children: [
                  // Waiting for the company to verify the transfer.
                  AppCard(
                    color: AppTone.warning.background,
                    borderColor: AppTone.warning.accent,
                    padding: const EdgeInsets.all(AppSpacing.s20),
                    child: Column(
                      children: [
                        const AppIconTile(
                          icon: Icons.hourglass_top_rounded,
                          tone: AppTone.warning,
                          size: 64,
                          radius: AppRadius.full,
                        ),
                        const SizedBox(height: AppSpacing.s12),
                        StatusChip(
                          label: l10n.pendingBanner,
                          tone: AppTone.warning,
                        ),
                        const SizedBox(height: AppSpacing.s8),
                        Text(
                          l10n.pendingTitle,
                          textAlign: TextAlign.center,
                          style: AppTextStyles.h3.copyWith(
                            color: AppTone.warning.foreground,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.s8),
                        Text(
                          l10n.pendingBody,
                          textAlign: TextAlign.center,
                          style: AppTextStyles.body.copyWith(
                            color: AppTone.warning.foreground,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s20),

                  AppCard(
                    padding: const EdgeInsets.all(AppSpacing.s16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              l10n.pendingOrderReference,
                              style: AppTextStyles.bodyStrong,
                            ),
                            const SizedBox(width: AppSpacing.s8),
                            Expanded(
                              child: Text(
                                '#${order.id}',
                                textAlign: TextAlign.end,
                                textDirection: TextDirection.ltr,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.bodyStrong.copyWith(
                                  color: AppColors.textBrand,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.s12),
                        const Divider(height: 1),
                        const SizedBox(height: AppSpacing.s8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                order.productName,
                                style: AppTextStyles.bodyStrong,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.s8),
                            Text(
                              l10n.orderQtyLine(order.quantity),
                              style: AppTextStyles.bodyStrong.copyWith(
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.s8),
                        KeyValueRow(
                          label: l10n.pendingDeliveryAddress,
                          value: orderDeliveryLabel(context, order),
                        ),
                        KeyValueRow(
                          label: l10n.orderContactPhone,
                          value: order.contactPhone,
                          valueTextDirection: TextDirection.ltr,
                        ),
                        if (order.installationSelected)
                          KeyValueRow(
                            label: l10n.pendingInstallation,
                            value: l10n.pendingInstallationIncluded(
                              _formatPrice(order.installationFee),
                            ),
                            valueColor: AppColors.textBrand,
                          ),
                        if (order.deliveryMethod == DeliveryMethod.delivery)
                          KeyValueRow(
                            label: l10n.orderDeliveryFee,
                            value: '${_formatPrice(order.deliveryFee)} SDG',
                          ),
                        KeyValueRow(
                          label: l10n.orderReceiptAttached,
                          value: order.receiptFileName ?? l10n.pendingUploaded,
                          valueColor: AppColors.successText,
                        ),
                        KeyValueRow(
                          label: l10n.orderOrderStatus,
                          value: order.orderStatus.label(l10n),
                          valueColor: AppColors.textBrand,
                        ),
                        KeyValueRow(
                          label: l10n.orderPaymentStatus,
                          value: order.paymentStatus.label(l10n),
                          valueColor: AppTone.warning.foreground,
                        ),
                        const SizedBox(height: AppSpacing.s8),
                        const Divider(height: 1),
                        const SizedBox(height: AppSpacing.s8),
                        PriceSummaryRow(
                          label: l10n.pendingTotalAmount,
                          value: '${_formatPrice(order.totalAmount)} SDG',
                          total: true,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s24),

                  AppButton.outlined(
                    label: l10n.commonViewOrderStatus,
                    icon: Icons.receipt_long_outlined,
                    expand: true,
                    onPressed: () =>
                        _leaveCheckout(context, tab: 1, openOrder: order),
                  ),
                  const SizedBox(height: AppSpacing.s12),

                  AppButton.primary(
                    label: l10n.pendingBackToMarketplace,
                    expand: true,
                    onPressed: () => _leaveCheckout(context),
                  ),
                  const SizedBox(height: AppSpacing.s12),
                  AppButton.outlined(
                    label: l10n.pendingViewInMyOrders,
                    expand: true,
                    onPressed: () => _leaveCheckout(context, tab: 1),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
