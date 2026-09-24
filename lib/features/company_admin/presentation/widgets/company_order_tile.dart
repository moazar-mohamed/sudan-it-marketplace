import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/order_labels.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../company_admin_format.dart';

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
                  showInstallationStatus
                      ? l10n.adminJobTitleNumber(order.shortId)
                      : l10n.orderTitleNumber(order.shortId),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyStrong,
                ),
              ),
              const SizedBox(width: AppSpacing.s8),
              Flexible(
                child: StatusChip(
                  label: showInstallationStatus
                      ? CompanyAdminFormat.installationJobStatus(order, l10n)
                      : order.orderStatus.label(l10n),
                  tone: order.orderStatus.tone,
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
            showInstallationStatus
                ? '${CompanyAdminFormat.customer(order, l10n)} • ${order.contactPhone}'
                : '${CompanyAdminFormat.customer(order, l10n)} • ${l10n.adminQtyShort(order.quantity)}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.caption
                .copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.s8),
          Row(
            children: [
              Expanded(
                child: Text(
                  showInstallationStatus
                      ? (order.deliveryMethod == DeliveryMethod.delivery
                          ? orderDeliveryLabel(context, order)
                          : l10n.adminCustomerPickup)
                      : CompanyAdminFormat.price(order.totalAmount),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyStrong.copyWith(
                    color: showInstallationStatus
                        ? AppColors.textPrimary
                        : AppColors.textBrand,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.s8),
              if (!showInstallationStatus)
                Flexible(
                  child: StatusChip(
                    label: order.paymentStatus.label(l10n),
                    tone: order.paymentStatus.tone,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.s4),
          Text(
            CompanyAdminFormat.date(order.createdAt),
            textDirection: TextDirection.ltr,
            style: AppTextStyles.labelSmall
                .copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
