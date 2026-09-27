import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../domain/entities/catalog_service.dart';
import '../service_details_screen.dart';

/// A catalogue service in the customer marketplace. Opens its details.
class ServiceCard extends StatelessWidget {
  const ServiceCard({
    super.key,
    required this.service,
    this.categoryName,
    this.highlight,
  });

  final CatalogService service;
  final String? categoryName;

  /// A search query whose matching words are marked in the name.
  final String? highlight;

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
          HighlightedText(
            service.name,
            query: highlight,
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
                  .copyWith(color: context.colors.textBrand),
            ),
          if (description.isNotEmpty)
            Text(
              description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption
                  .copyWith(color: context.colors.textSecondary),
            ),
        ],
      ),
    );
  }
}
