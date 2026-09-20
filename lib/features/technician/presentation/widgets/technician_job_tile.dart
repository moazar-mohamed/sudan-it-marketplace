import 'package:flutter/material.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../technician_format.dart';
import 'technician_widgets.dart';
import '../../../../core/localization/l10n_extension.dart';

/// A single assigned installation job row, used by the Jobs tab and the
/// Dashboard tab.
class TechnicianJobTile extends StatelessWidget {
  const TechnicianJobTile({super.key, required this.order, required this.onTap});

  final OrderEntity order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final statusColor = TechnicianFormat.jobStatusColor(order.orderStatus);

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
                      context.l10n.adminJobTitleNumber(order.shortId),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: TechnicianStatusBadge(
                      label: TechnicianFormat.jobStatusLabel(order, context.l10n),
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
                '${TechnicianFormat.customer(order, context.l10n)} • ${order.contactPhone}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                order.deliveryMethod == DeliveryMethod.delivery
                    ? orderDeliveryLabel(context, order)
                    : context.l10n.adminCustomerPickupConfirmShort,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                TechnicianFormat.date(order.createdAt),
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
