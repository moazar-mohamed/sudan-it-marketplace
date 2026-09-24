import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../domain/entities/catalog_service.dart';
import '../service_details_screen.dart';

/// A catalogue service in the customer marketplace. Opens its details.
class ServiceCard extends StatelessWidget {
  const ServiceCard({super.key, required this.service, this.categoryName});

  final CatalogService service;
  final String? categoryName;

  @override
  Widget build(BuildContext context) {
    final description = service.description.trim();
    final category = categoryName?.trim() ?? '';

    return AppListCard(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ServiceDetailsScreen(service: service),
        ),
      ),
      leading: const AppIconTile(
        icon: Icons.miscellaneous_services_outlined,
        size: 52,
      ),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            service.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodyStrong,
          ),
          if (category.isNotEmpty)
            Text(
              category,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.captionStrong
                  .copyWith(color: AppColors.textBrand),
            ),
          if (description.isNotEmpty)
            Text(
              description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption
                  .copyWith(color: AppColors.textSecondary),
            ),
        ],
      ),
    );
  }
}
