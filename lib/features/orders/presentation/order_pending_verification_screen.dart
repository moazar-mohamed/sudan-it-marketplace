import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../auth/presentation/auth_gate.dart';
import '../domain/entities/order_entity.dart';
import 'order_details_screen.dart';
import 'widgets/order_location_widgets.dart';
import 'widgets/price_summary_row.dart';
import 'order_labels.dart';
import '../../../core/localization/l10n_extension.dart';

class OrderPendingVerificationScreen extends StatelessWidget {
  const OrderPendingVerificationScreen({
    super.key,
    required this.order,
  });

  final OrderEntity order;

  String _formatPrice(double price) {
    final parts = price.toStringAsFixed(0).split('.');
    final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return parts[0].replaceAllMapped(regExp, (Match m) => '${m[1]},');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.orderOrderStatus),
        automaticallyImplyLeading: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
        child: Column(
          children: [
            // Pending Verification Status Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: Colors.amber.shade400,
                  width: 1.5,
                ),
              ),
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: Colors.amber.shade100,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.hourglass_top_rounded,
                      color: Colors.amber.shade900,
                      size: 36,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade200,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      context.l10n.pendingBanner,
                      style: textTheme.labelSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: Colors.amber.shade900,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    context.l10n.pendingTitle,
                    textAlign: TextAlign.center,
                    style: textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: Colors.amber.shade900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    context.l10n.pendingBody,
                    textAlign: TextAlign.center,
                    style: textTheme.bodySmall?.copyWith(
                      color: Colors.amber.shade900,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Order Details Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: colorScheme.onSurface.withValues(alpha: 0.08),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        context.l10n.pendingOrderReference,
                        style: textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '#${order.id}',
                          textAlign: TextAlign.end,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 10),
                  // Product Row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          order.productName,
                          style: textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        context.l10n.orderQtyLine(order.quantity),
                        style: textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: colorScheme.onSurface.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildDetailRow(
                    context.l10n.pendingDeliveryAddress,
                    orderDeliveryLabel(context, order),
                    textTheme,
                    colorScheme,
                  ),
                  const SizedBox(height: 8),
                  _buildDetailRow(
                    context.l10n.orderContactPhone,
                    order.contactPhone,
                    textTheme,
                    colorScheme,
                  ),
                  if (order.installationSelected) ...[
                    const SizedBox(height: 8),
                    _buildDetailRow(
                      context.l10n.pendingInstallation,
                      context.l10n.pendingInstallationIncluded(_formatPrice(order.installationFee)),
                      textTheme,
                      colorScheme,
                      valueColor: AppColors.primary,
                    ),
                  ],
                  if (order.deliveryMethod == DeliveryMethod.delivery) ...[
                    const SizedBox(height: 8),
                    _buildDetailRow(
                      context.l10n.orderDeliveryFee,
                      '${_formatPrice(order.deliveryFee)} SDG',
                      textTheme,
                      colorScheme,
                    ),
                  ],
                  const SizedBox(height: 8),
                  _buildDetailRow(
                    context.l10n.orderReceiptAttached,
                    order.receiptFileName ?? context.l10n.pendingUploaded,
                    textTheme,
                    colorScheme,
                    valueColor: AppColors.success,
                  ),
                  const SizedBox(height: 8),
                  _buildDetailRow(
                    context.l10n.orderOrderStatus,
                    order.orderStatus.label(context.l10n),
                    textTheme,
                    colorScheme,
                    valueColor: AppColors.primary,
                  ),
                  const SizedBox(height: 8),
                  _buildDetailRow(
                    context.l10n.orderPaymentStatus,
                    order.paymentStatus.label(context.l10n),
                    textTheme,
                    colorScheme,
                    valueColor: Colors.amber.shade900,
                  ),
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 8),
                  PriceSummaryRow(
                    label: context.l10n.pendingTotalAmount,
                    value: '${_formatPrice(order.totalAmount)} SDG',
                    labelStyle: textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                    valueStyle: textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            OutlinedButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => OrderDetailsScreen(order: order),
                  ),
                );
              },
              icon: const Icon(Icons.receipt_long_outlined),
              label: Text(context.l10n.commonViewOrderStatus),
            ),
            const SizedBox(height: 12),

            // Back to Marketplace Button
            // Both buttons restart from the AuthGate, not from a bare dashboard:
            // a dashboard with no gate above it cannot return to the login
            // screen when the customer signs out.
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute<void>(builder: (_) => const AuthGate()),
                  (route) => false,
                );
              },
              child: Text(context.l10n.pendingBackToMarketplace),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute<void>(
                    builder: (_) => const AuthGate(customerInitialTab: 1),
                  ),
                  (route) => false,
                );
              },
              child: Text(context.l10n.pendingViewInMyOrders),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(
    String label,
    String value,
    TextTheme textTheme,
    ColorScheme colorScheme, {
    Color? valueColor,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        SizedBox(
          width: 125,
          child: Text(
            label,
            style: textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: valueColor ?? colorScheme.onSurface,
            ),
          ),
        ),
      ],
    );
  }
}
