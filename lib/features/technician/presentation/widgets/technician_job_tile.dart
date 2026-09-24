import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../technician_format.dart';

/// A single assigned installation job row, used by the Jobs tab and the
/// Dashboard tab.
class TechnicianJobTile extends StatelessWidget {
  const TechnicianJobTile({super.key, required this.order, required this.onTap});

  final OrderEntity order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.adminJobTitleNumber(order.shortId),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyStrong,
                ),
              ),
              const SizedBox(width: AppSpacing.s8),
              Flexible(
                child: StatusChip(
                  label: TechnicianFormat.jobStatusLabel(order, l10n),
                  tone: TechnicianFormat.jobStatusTone(order.orderStatus),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s8),
          Text(
            order.productName,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodyStrong,
          ),
          Text(
            '${TechnicianFormat.customer(order, l10n)} • ${order.contactPhone}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.caption
                .copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.s8),
          Text(
            order.deliveryMethod == DeliveryMethod.delivery
                ? orderDeliveryLabel(context, order)
                : l10n.adminCustomerPickupConfirmShort,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodyStrong,
          ),
          const SizedBox(height: AppSpacing.s4),
          Text(
            TechnicianFormat.date(order.createdAt),
            textDirection: TextDirection.ltr,
            style: AppTextStyles.labelSmall
                .copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
