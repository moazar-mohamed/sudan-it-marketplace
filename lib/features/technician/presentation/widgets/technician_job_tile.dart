import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/phone_number.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../technician_format.dart';
import '../technician_job_helpers.dart';

/// A single assigned installation job row, used by the Jobs tab and the
/// Dashboard tab: what it is, for whom, where, how far, and what is blocking
/// it, with call and directions one tap away.
class TechnicianJobTile extends ConsumerWidget {
  const TechnicianJobTile({
    super.key,
    required this.order,
    required this.onTap,
    this.distanceKm,
    this.highlight,
  });

  final OrderEntity order;
  final VoidCallback onTap;

  /// The words searched for, marked in the product and the customer.
  final String? highlight;

  /// Km from the technician to the delivery point, when both are known.
  final double? distanceKm;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final colors = context.colors;
    final cancelled = order.isCancelled;
    final waitingPayment = !cancelled &&
        order.orderStatus != OrderStatus.completed &&
        order.paymentStatus != PaymentStatus.confirmed;
    final canAct = !cancelled && order.orderStatus != OrderStatus.completed;
    final place = order.deliveryMethod == DeliveryMethod.delivery
        ? orderDeliveryLabel(context, order)
        : l10n.adminCustomerPickupConfirmShort;

    return Opacity(
      opacity: cancelled ? 0.75 : 1,
      child: AppCard(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: HighlightedText(
                    order.productName,
                    query: highlight,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodyStrong,
                  ),
                ),
                const SizedBox(width: AppSpacing.s8),
                Flexible(
                  child: StatusChip(
                    label: cancelled
                        ? l10n.tjCancelledTag
                        : TechnicianFormat.jobStatusLabel(order, l10n),
                    tone: cancelled
                        ? AppTone.error
                        : TechnicianFormat.jobStatusTone(order.orderStatus),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.s4),
            HighlightedText(
              '${TechnicianFormat.customer(order, l10n)} • ${keepLeftToRight(displayPhone(order.contactPhone))}',
              query: highlight,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.s8),
            Row(
              children: [
                Icon(Icons.place_outlined, size: 16, color: colors.iconMuted),
                const SizedBox(width: AppSpacing.s4),
                Expanded(
                  child: Text(
                    place,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.body,
                  ),
                ),
                if (distanceKm != null) ...[
                  const SizedBox(width: AppSpacing.s8),
                  Text(
                    l10n.tjDistanceKm(formatKm(distanceKm!)),
                    style: AppTextStyles.captionStrong
                        .copyWith(color: colors.textSecondary),
                  ),
                ],
              ],
            ),
            if (waitingPayment) ...[
              const SizedBox(height: AppSpacing.s8),
              StatusChip(
                label: l10n.tjAwaitingPaymentTag,
                tone: AppTone.warning,
              ),
            ],
            const SizedBox(height: AppSpacing.s8),
            Row(
              children: [
                Expanded(
                  child: Text(
                    TechnicianFormat.date(order.createdAt),
                    textDirection: TextDirection.ltr,
                    textAlign: TextAlign.start,
                    style: AppTextStyles.labelSmall
                        .copyWith(color: colors.textSecondary),
                  ),
                ),
                if (canAct) ...[
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    tooltip: l10n.tjCall,
                    icon: const Icon(Icons.phone_outlined),
                    onPressed: order.contactPhone.trim().isEmpty
                        ? null
                        : () => callCustomer(context, order.contactPhone),
                  ),
                  if (jobHasDirections(order))
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      tooltip: l10n.tjNavigate,
                      icon: const Icon(Icons.navigation_outlined),
                      onPressed: () async {
                        final opened = await openJobDirections(ref, order);
                        if (!opened && context.mounted) {
                          showMapsFailed(context);
                        }
                      },
                    ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
