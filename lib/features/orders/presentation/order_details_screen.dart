import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../customer_dashboard/data/mock_marketplace_data.dart';
import '../../location/presentation/location_strings.dart';
import '../domain/entities/order_entity.dart';
import 'widgets/order_location_widgets.dart';
import 'widgets/price_summary_row.dart';
import 'order_labels.dart';
import '../../../core/localization/l10n_extension.dart';

class OrderDetailsScreen extends StatelessWidget {
  const OrderDetailsScreen({
    super.key,
    required this.order,
  });

  final OrderEntity order;

  String _formatPrice(double price) {
    final parts = price.toStringAsFixed(0).split('.');
    final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return parts[0].replaceAllMapped(regExp, (Match m) => '${m[1]},');
  }

  String _resolveCompanyName() {
    if (order.companyName.isNotEmpty) {
      return order.companyName;
    }
    for (final company in mockCompanies) {
      if (company.id == order.companyId) {
        return company.name;
      }
    }
    return 'IT Partner Co.';
  }

  String _formatDate(DateTime dt) {
    final y = dt.year;
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final h = dt.hour.toString().padLeft(2, '0');
    final min = dt.minute.toString().padLeft(2, '0');
    return '$y-$m-$d $h:$min';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final companyName = _resolveCompanyName();

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.orderTitleNumber(order.id.length > 8 ? order.id.substring(0, 8) : order.id)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Flow Card: Processing → Out for Delivery → Completed
            _buildStatusFlowCard(context),
            const SizedBox(height: 16),

            // Product & Company Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: colorScheme.onSurface.withValues(alpha: 0.08),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    context.l10n.orderItemOrdered,
                    style: textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: AppColors.secondary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.inventory_2_outlined,
                            color: AppColors.primary,
                            size: 26,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              order.productName,
                              style: textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(
                                  Icons.business_outlined,
                                  size: 14,
                                  color: colorScheme.onSurface
                                      .withValues(alpha: 0.6),
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    companyName,
                                    style: textTheme.bodySmall?.copyWith(
                                      color: colorScheme.onSurface
                                          .withValues(alpha: 0.7),
                                      fontWeight: FontWeight.w500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            PriceSummaryRow(
                              label: context.l10n.orderUnitLine(_formatPrice(order.unitPrice)),
                              value: context.l10n.orderQtyLine(order.quantity),
                              labelStyle: textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurface.withValues(alpha: 0.6),
                              ),
                              valueStyle: textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              context.l10n.orderSubtotalLine(_formatPrice(order.productSubtotal)),
                              style: textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Delivery & Contact Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: colorScheme.onSurface.withValues(alpha: 0.08),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    order.deliveryMethod == DeliveryMethod.pickup
                        ? context.l10n.orderPickupDetails
                        : context.l10n.orderDeliveryDetails,
                    style: textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildRow(
                    context.l10n.orderAddress,
                    orderDeliveryLabel(context, order),
                    textTheme,
                    colorScheme,
                  ),
                  const SizedBox(height: 8),
                  OrderLocationButton(
                    order: order,
                    label: LocationStrings.of(context).openDeliveryLocation,
                  ),
                  PickupCompanyLocationButton(order: order),
                  const SizedBox(height: 8),
                  _buildRow(context.l10n.orderContactPhone, order.contactPhone, textTheme, colorScheme),
                  const SizedBox(height: 8),
                  if (order.installationSelected) ...[
                    _buildRow(
                      context.l10n.orderType,
                      context.l10n.orderTypeInstallation(_formatPrice(order.installationFee)),
                      textTheme,
                      colorScheme,
                      valueColor: AppColors.primary,
                    ),
                    const SizedBox(height: 8),
                  ],
                  if (order.deliveryMethod == DeliveryMethod.delivery) ...[
                    _buildRow(
                      context.l10n.orderDeliveryFee,
                      '${_formatPrice(order.deliveryFee)} SDG',
                      textTheme,
                      colorScheme,
                    ),
                    const SizedBox(height: 8),
                  ],
                  _buildRow(
                    context.l10n.orderOrderedAt,
                    _formatDate(order.createdAt),
                    textTheme,
                    colorScheme,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Payment Status Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: colorScheme.onSurface.withValues(alpha: 0.08),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    context.l10n.orderPaymentStatus,
                    style: textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        context.l10n.orderStatusLabel,
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurface.withValues(alpha: 0.6),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: order.paymentStatus == PaymentStatus.confirmed
                              ? AppColors.success.withValues(alpha: 0.12)
                              : Colors.amber.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: order.paymentStatus == PaymentStatus.confirmed
                                ? AppColors.success
                                : Colors.amber.shade700,
                          ),
                        ),
                        child: Text(
                          order.paymentStatus.label(context.l10n),
                          style: textTheme.labelSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: order.paymentStatus == PaymentStatus.confirmed
                                ? AppColors.success
                                : Colors.amber.shade900,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (order.receiptFileName != null) ...[
                    const SizedBox(height: 8),
                    _buildRow(
                      context.l10n.orderReceiptAttached,
                      order.receiptFileName!,
                      textTheme,
                      colorScheme,
                      valueColor: AppColors.success,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Price Summary Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: colorScheme.onSurface.withValues(alpha: 0.08),
                ),
              ),
              child: Column(
                children: [
                  PriceSummaryRow(
                    label: context.l10n.orderProductSubtotal,
                    value: '${_formatPrice(order.productSubtotal)} SDG',
                    labelStyle: textTheme.bodyMedium,
                    valueStyle: textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (order.installationSelected) ...[
                    const SizedBox(height: 8),
                    PriceSummaryRow(
                      label: context.l10n.orderInstallationFee,
                      value: '+${_formatPrice(order.installationFee)} SDG',
                      labelStyle: textTheme.bodyMedium,
                      valueStyle: textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                  if (order.deliveryMethod == DeliveryMethod.delivery) ...[
                    const SizedBox(height: 8),
                    PriceSummaryRow(
                      label: context.l10n.orderDeliveryFee,
                      value: '${_formatPrice(order.deliveryFee)} SDG',
                      labelStyle: textTheme.bodyMedium,
                      valueStyle: textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 8),
                  PriceSummaryRow(
                    label: context.l10n.orderTotal,
                    value: '${_formatPrice(order.totalAmount)} SDG',
                    labelStyle: textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                    valueStyle: textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusFlowCard(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;

    final steps = [
      OrderStatus.processing,
      OrderStatus.outForDelivery,
      OrderStatus.completed,
    ];

    final currentIndex = switch (order.orderStatus) {
      OrderStatus.processing => 0,
      OrderStatus.outForDelivery => 1,
      OrderStatus.completed => 2,
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: colorScheme.onSurface.withValues(alpha: 0.08),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                context.l10n.orderOrderStatus,
                style: textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  order.orderStatus.label(context.l10n),
                  style: textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              for (int i = 0; i < steps.length; i++) ...[
                Expanded(
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: i <= currentIndex
                            ? AppColors.primary
                            : colorScheme.onSurface.withValues(alpha: 0.15),
                        child: Icon(
                          i < currentIndex
                              ? Icons.check
                              : (i == currentIndex
                                  ? (order.orderStatus == OrderStatus.completed
                                      ? Icons.check
                                      : Icons.circle)
                                  : Icons.circle_outlined),
                          size: 14,
                          color: i <= currentIndex
                              ? Colors.white
                              : colorScheme.onSurface.withValues(alpha: 0.4),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        steps[i].label(context.l10n),
                        textAlign: TextAlign.center,
                        style: textTheme.labelSmall?.copyWith(
                          fontWeight: i == currentIndex
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: i <= currentIndex
                              ? colorScheme.onSurface
                              : colorScheme.onSurface.withValues(alpha: 0.45),
                        ),
                      ),
                    ],
                  ),
                ),
                if (i < steps.length - 1)
                  Expanded(
                    child: Container(
                      height: 2,
                      margin: const EdgeInsets.only(bottom: 20),
                      color: i < currentIndex
                          ? AppColors.primary
                          : colorScheme.onSurface.withValues(alpha: 0.15),
                    ),
                  ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRow(
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
          width: 120,
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
