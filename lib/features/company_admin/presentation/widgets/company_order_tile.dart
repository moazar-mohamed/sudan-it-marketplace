import 'package:flutter/material.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../company_admin_format.dart';
import 'status_badge.dart';

class CompanyOrderTile extends StatelessWidget {
  const CompanyOrderTile({
    super.key,
    required this.order,
    required this.onTap,
    this.showInstallationStatus = false,
  });

  final OrderEntity order;
  final VoidCallback onTap;

  /// Installation jobs show the job status instead of payment status.
  final bool showInstallationStatus;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final statusColor = CompanyAdminFormat.orderStatusColor(order.orderStatus);

    return Material(
      color: colorScheme.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: colorScheme.onSurface.withValues(alpha: 0.08),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${showInstallationStatus ? 'Job' : 'Order'} #${order.shortId}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: StatusBadge(
                      label: showInstallationStatus
                          ? CompanyAdminFormat.installationJobStatus(order)
                          : order.orderStatus.displayName,
                      color: statusColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                order.productName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                showInstallationStatus
                    ? '${CompanyAdminFormat.customer(order)} • ${order.contactPhone}'
                    : '${CompanyAdminFormat.customer(order)} • Qty ${order.quantity}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      showInstallationStatus
                          ? (order.deliveryMethod == DeliveryMethod.delivery
                              ? orderDeliveryLabel(context, order)
                              : 'Customer pickup')
                          : CompanyAdminFormat.price(order.totalAmount),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: showInstallationStatus
                            ? colorScheme.onSurface
                            : colorScheme.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (!showInstallationStatus)
                    Flexible(
                      child: StatusBadge(
                        label: order.paymentStatus.displayName,
                        color: CompanyAdminFormat.paymentStatusColor(
                          order.paymentStatus,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                CompanyAdminFormat.date(order.createdAt),
                style: textTheme.labelSmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
