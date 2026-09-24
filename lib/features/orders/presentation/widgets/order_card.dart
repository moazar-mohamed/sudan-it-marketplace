import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../customer_dashboard/data/mock_marketplace_data.dart';
import '../../domain/entities/order_entity.dart';
import '../order_details_screen.dart';
import '../order_labels.dart';
import '../../../../core/localization/l10n_extension.dart';

class OrderCard extends StatelessWidget {
  const OrderCard({
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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final companyName = _resolveCompanyName();

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.s16),
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => OrderDetailsScreen(order: order),
          ),
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.orderTitleNumber(
                    order.id.length > 8 ? order.id.substring(0, 8) : order.id,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyStrong,
                ),
              ),
              const SizedBox(width: AppSpacing.s8),
              Flexible(
                child: StatusChip(
                  label: order.orderStatus.label(l10n),
                  tone: order.orderStatus.tone,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s12),
          Text(
            order.productName,
            style: AppTextStyles.bodyStrong,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.s4),
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
                  style: AppTextStyles.caption
                      .copyWith(color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s12),
          const Divider(height: 1),
          const SizedBox(height: AppSpacing.s8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.orderTotalAmount,
                    style: AppTextStyles.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                  Text(
                    '${_formatPrice(order.totalAmount)} SDG',
                    style: AppTextStyles.bodyStrong
                        .copyWith(color: AppColors.textBrand),
                  ),
                ],
              ),
              Row(
                children: [
                  Text(
                    l10n.orderDetailsButton,
                    style: AppTextStyles.captionStrong
                        .copyWith(color: AppColors.textBrand),
                  ),
                  const SizedBox(width: AppSpacing.s4),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.primary,
                    size: AppSize.iconMd,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
