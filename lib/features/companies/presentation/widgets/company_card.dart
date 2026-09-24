import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../domain/entities/company.dart';
import '../company_details_screen.dart';

class CompanyCard extends StatelessWidget {
  const CompanyCard({
    super.key,
    required this.company,
  });

  final Company company;

  @override
  Widget build(BuildContext context) {
    return AppListCard(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => CompanyDetailsScreen(company: company),
          ),
        );
      },
      leading: AppImageTile(
        imageUrl: company.logoUrl,
        fallbackText: company.name.isNotEmpty ? company.name : 'C',
      ),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            company.name,
            style: AppTextStyles.bodyStrong,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.s4),
          Row(
            children: [
              const Icon(
                Icons.star_rounded,
                color: AppColors.warning,
                size: AppSize.iconMd,
              ),
              const SizedBox(width: AppSpacing.s4),
              Text(
                company.rating.toStringAsFixed(1),
                style: AppTextStyles.captionStrong,
              ),
              const SizedBox(width: AppSpacing.s6),
              Flexible(
                child: Text(
                  context.l10n.reviewsCount(company.reviewCount),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption
                      .copyWith(color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
