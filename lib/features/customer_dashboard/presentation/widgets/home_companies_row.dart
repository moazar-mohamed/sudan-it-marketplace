import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../companies/presentation/company_details_screen.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/review_widgets.dart';
import '../../../reviews/presentation/reviews_providers.dart';
import 'home_design.dart';

/// A company's average now, falling back to the figures stored on the company
/// (the demo companies) while nobody has rated it.
({double average, int count}) companyRating(
  Company company,
  Map<String, RatingStats> ratings,
) {
  final stats = ratings[RatingStats.companyKey(company.id)];
  if (stats != null && stats.hasRatings) {
    return (average: stats.average, count: stats.count);
  }
  return (average: company.rating, count: company.reviewCount);
}

/// Companies best rated first; those tied keep their order.
List<Company> companiesByRating(
  List<Company> companies,
  Map<String, RatingStats> ratings,
) {
  final indexed = [
    for (var i = 0; i < companies.length; i++) (i, companies[i]),
  ];
  indexed.sort((a, b) {
    final ra = companyRating(a.$2, ratings);
    final rb = companyRating(b.$2, ratings);
    final byAverage = rb.average.compareTo(ra.average);
    if (byAverage != 0) return byAverage;
    final byCount = rb.count.compareTo(ra.count);
    return byCount != 0 ? byCount : a.$1.compareTo(b.$1);
  });
  return [for (final entry in indexed) entry.$2];
}

/// "Verified companies" on the products tab: the best rated ones, as small
/// cards in a sideways row. Every company shown here was approved by Platform
/// Admin, which is what the check mark stands for.
class HomeVerifiedCompaniesRow extends ConsumerWidget {
  const HomeVerifiedCompaniesRow({
    super.key,
    required this.companies,
    required this.horizontalPadding,
    required this.onViewAll,
    this.maxItems = 8,
  });

  final List<Company> companies;
  final double horizontalPadding;
  final VoidCallback onViewAll;
  final int maxItems;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (companies.isEmpty) return const SizedBox.shrink();
    final ratings = ref.watch(ratingsProvider).asData?.value ?? const {};
    final top = companiesByRating(companies, ratings).take(maxItems).toList();
    final side = EdgeInsets.symmetric(horizontal: horizontalPadding);
    return Column(
      key: const ValueKey('home-verified-companies'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: side,
          child: HomeSectionHeader(
            title: context.l10n.homeVerifiedCompanies,
            actionLabel: context.l10n.homeAllCompanies,
            actionKey: const ValueKey('home-all-companies'),
            onAction: onViewAll,
          ),
        ),
        const SizedBox(height: AppSpacing.s12),
        SizedBox(
          height: 156,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: side,
            itemCount: top.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.s12),
            itemBuilder: (context, i) => _CompanyTile(company: top[i]),
          ),
        ),
      ],
    );
  }
}

class _CompanyTile extends StatelessWidget {
  const _CompanyTile({required this.company});

  final Company company;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SizedBox(
      width: 150,
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.lgAll,
          side: BorderSide(color: colors.borderDefault),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => CompanyDetailsScreen(company: company),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.s12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CompanyAvatar(
                  company: company,
                  size: 60,
                  shape: BoxShape.circle,
                ),
                const SizedBox(height: AppSpacing.s8),
                Expanded(
                  child: Center(
                    child: Text(
                      company.name,
                      maxLines: 2,
                      textAlign: TextAlign.center,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodyStrong.copyWith(height: 1.3),
                    ),
                  ),
                ),
                RatingLine(
                  ratingsKey: RatingStats.companyKey(company.id),
                  fallbackAverage: company.rating,
                  fallbackCount: company.reviewCount,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A company's logo, or its first letter on the soft colour its name gets,
/// with the blue "verified" check when [verified].
class CompanyAvatar extends StatelessWidget {
  const CompanyAvatar({
    super.key,
    required this.company,
    this.size = 60,
    this.shape = BoxShape.circle,
    this.verified = true,
  });

  final Company company;
  final double size;
  final BoxShape shape;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final look = lookForSeed(company.name);
    final name = company.name.trim();
    final letter = name.isEmpty ? 'C' : name.characters.first.toUpperCase();
    final radius = shape == BoxShape.circle
        ? null
        : BorderRadius.circular(size * 0.28);
    final avatar = Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: look.tint(context),
        shape: shape,
        borderRadius: radius,
      ),
      child: AppNetworkImage(
        url: company.logoUrl ?? '',
        fallback: Center(
          child: Text(
            letter,
            style: AppTextStyles.h1.copyWith(
              color: look.accent,
              fontSize: size * 0.4,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
    if (!verified) return avatar;
    final badge = size * 0.36;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          avatar,
          PositionedDirectional(
            bottom: -badge * 0.15,
            start: -badge * 0.15,
            child: Container(
              width: badge,
              height: badge,
              decoration: BoxDecoration(
                color: colors.primary,
                shape: BoxShape.circle,
                border: Border.all(color: colors.surface, width: 2),
              ),
              child: Icon(
                Icons.check_rounded,
                size: badge * 0.62,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
