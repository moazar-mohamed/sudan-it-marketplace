import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
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
    final l10n = context.l10n;
    final companyName = _resolveCompanyName();
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);
    const gap = SizedBox(height: AppSpacing.s16);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          l10n.orderTitleNumber(
            order.id.length > 8 ? order.id.substring(0, 8) : order.id,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Processing -> Out for delivery -> Completed.
                _buildStatusFlowCard(context),
                gap,

                SectionCard(
                  title: l10n.orderItemOrdered,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const AppImageTile(),
                        const SizedBox(width: AppSpacing.s12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                order.productName,
                                style: AppTextStyles.bodyStrong,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.business_outlined,
                                    size: AppSize.iconSm,
                                    color: AppColors.iconDefault,
                                  ),
                                  const SizedBox(width: AppSpacing.s4),
                                  Expanded(
                                    child: Text(
                                      companyName,
                                      style: AppTextStyles.caption.copyWith(
                                        color: AppColors.textSecondary,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.s6),
                              PriceSummaryRow(
                                label: l10n.orderUnitLine(
                                  _formatPrice(order.unitPrice),
                                ),
                                value: l10n.orderQtyLine(order.quantity),
                                labelStyle: AppTextStyles.caption
                                    .copyWith(color: AppColors.textSecondary),
                                valueStyle: AppTextStyles.captionStrong,
                              ),
                              Text(
                                l10n.orderSubtotalLine(
                                  _formatPrice(order.productSubtotal),
                                ),
                                style: AppTextStyles.bodyStrong
                                    .copyWith(color: AppColors.textBrand),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                gap,

                SectionCard(
                  title: order.deliveryMethod == DeliveryMethod.pickup
                      ? l10n.orderPickupDetails
                      : l10n.orderDeliveryDetails,
                  gap: AppSpacing.s8,
                  children: [
                    KeyValueRow(
                      label: l10n.orderAddress,
                      value: orderDeliveryLabel(context, order),
                    ),
                    OrderLocationButton(
                      order: order,
                      label: LocationStrings.of(context).openDeliveryLocation,
                    ),
                    PickupCompanyLocationButton(order: order),
                    KeyValueRow(
                      label: l10n.orderContactPhone,
                      value: order.contactPhone,
                      valueTextDirection: TextDirection.ltr,
                    ),
                    if (order.installationSelected)
                      KeyValueRow(
                        label: l10n.orderType,
                        value: l10n.orderTypeInstallation(
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
                      label: l10n.orderOrderedAt,
                      value: _formatDate(order.createdAt),
                      valueTextDirection: TextDirection.ltr,
                    ),
                  ],
                ),
                gap,

                SectionCard(
                  title: l10n.orderPaymentStatus,
                  gap: AppSpacing.s8,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          l10n.orderStatusLabel,
                          style: AppTextStyles.body
                              .copyWith(color: AppColors.textSecondary),
                        ),
                        StatusChip(
                          label: order.paymentStatus.label(l10n),
                          tone: order.paymentStatus.tone,
                        ),
                      ],
                    ),
                    if (order.receiptFileName != null)
                      KeyValueRow(
                        label: l10n.orderReceiptAttached,
                        value: order.receiptFileName!,
                        valueColor: AppColors.successText,
                      ),
                  ],
                ),
                gap,

                AppCard(
                  padding: const EdgeInsets.all(AppSpacing.s16),
                  child: Column(
                    children: [
                      PriceSummaryRow(
                        label: l10n.orderProductSubtotal,
                        value: '${_formatPrice(order.productSubtotal)} SDG',
                      ),
                      if (order.installationSelected) ...[
                        const SizedBox(height: AppSpacing.s8),
                        PriceSummaryRow(
                          label: l10n.orderInstallationFee,
                          value: '+${_formatPrice(order.installationFee)} SDG',
                        ),
                      ],
                      if (order.deliveryMethod == DeliveryMethod.delivery) ...[
                        const SizedBox(height: AppSpacing.s8),
                        PriceSummaryRow(
                          label: l10n.orderDeliveryFee,
                          value: '${_formatPrice(order.deliveryFee)} SDG',
                        ),
                      ],
                      const SizedBox(height: AppSpacing.s12),
                      const Divider(height: 1),
                      const SizedBox(height: AppSpacing.s12),
                      PriceSummaryRow(
                        label: l10n.orderTotal,
                        value: '${_formatPrice(order.totalAmount)} SDG',
                        total: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusFlowCard(BuildContext context) {
    final l10n = context.l10n;
    const steps = [
      OrderStatus.processing,
      OrderStatus.outForDelivery,
      OrderStatus.completed,
    ];
    final currentIndex = steps.indexOf(order.orderStatus);

    return SectionCard(
      title: l10n.orderOrderStatus,
      trailing: StatusChip(
        label: order.orderStatus.label(l10n),
        tone: order.orderStatus.tone,
      ),
      gap: AppSpacing.s16,
      children: [
        AppStepTracker(
          labels: [for (final step in steps) step.label(l10n)],
          currentIndex: currentIndex,
          allDone: order.orderStatus == OrderStatus.completed,
        ),
      ],
    );
  }
}
