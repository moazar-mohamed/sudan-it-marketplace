import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../domain/entities/company.dart';
import '../company_details_screen.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/review_widgets.dart';

class CompanyCard extends StatelessWidget {
  const CompanyCard({
    super.key,
    required this.company,
    this.highlight,
  });

  final Company company;

  /// A search query whose matching words are marked in the name.
  final String? highlight;

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
          HighlightedText(
            company.name,
            query: highlight,
            style: AppTextStyles.bodyStrong,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.s4),
          RatingLine(
            ratingsKey: RatingStats.companyKey(company.id),
            fallbackAverage: company.rating,
            fallbackCount: company.reviewCount,
          ),
        ],
      ),
    );
  }
}
