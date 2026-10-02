import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../categories/presentation/category_label.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../companies/presentation/company_details_screen.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/reviews_providers.dart';
import 'home_companies_row.dart';
import 'home_company_view.dart';
import 'home_design.dart';

/// The Companies tab: category chips, the count and sort, the best rated
/// company as a big card, then the others as rows.
class HomeCompaniesTab extends ConsumerWidget {
  const HomeCompaniesTab({
    super.key,
    required this.companies,
    required this.topCategories,
    required this.categoriesById,
    required this.categoryId,
    required this.sort,
    required this.onCategoryChanged,
    required this.onSortChanged,
    required this.horizontalPadding,
  });

  /// Every company customers can see.
  final List<Company> companies;

  /// The top-level categories each company works in (see
  /// [companyTopCategories]).
  final Map<String, List<String>> topCategories;
  final Map<String, Category> categoriesById;

  /// The category chip chosen, or null for all.
  final String? categoryId;
  final CompanySort sort;
  final ValueChanged<String?> onCategoryChanged;
  final ValueChanged<CompanySort> onSortChanged;
  final double horizontalPadding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final ratings =
        ref.watch(ratingsProvider).asData?.value ??
        const <String, RatingStats>{};
    final shown = viewCompanies(
      companies,
      sort: sort,
      ratings: ratings,
      categoriesOf: topCategories,
      categoryId: categoryId,
    );
    // The chips: the top-level categories some company works in.
    final chipIds = <String>[];
    for (final entry in categoriesById.values) {
      if (entry.parentId == null &&
          topCategories.values.any((ids) => ids.contains(entry.id))) {
        chipIds.add(entry.id);
      }
    }
    chipIds.sort(
      (a, b) => compareCategories(categoriesById[a]!, categoriesById[b]!),
    );
    final side = EdgeInsets.symmetric(horizontal: horizontalPadding);

    // The best rated company gets the big card, but only when the list is
    // ordered by rating and someone really rated it.
    final feature =
        sort == CompanySort.topRated &&
            shown.isNotEmpty &&
            companyRating(shown.first, ratings).count > 0
        ? shown.first
        : null;
    final rest = feature == null ? shown : shown.skip(1).toList();

    return Column(
      key: const ValueKey('home-companies-tab'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (chipIds.isNotEmpty) ...[
          SingleChildScrollView(
            key: const ValueKey('home-company-chips'),
            scrollDirection: Axis.horizontal,
            padding: side,
            child: Row(
              children: [
                _CategoryChip(
                  label: l10n.homeFilterAllCategories,
                  selected: categoryId == null,
                  onTap: () => onCategoryChanged(null),
                ),
                for (final id in chipIds) ...[
                  const SizedBox(width: AppSpacing.s8),
                  _CategoryChip(
                    label: categoriesById[id]!.localizedName(context),
                    selected: categoryId == id,
                    onTap: () => onCategoryChanged(id),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.s12),
        ],
        Padding(
          padding: side,
          child: Row(
            children: [
              Expanded(
                child: Text(
                  l10n.homeCompaniesCount(shown.length),
                  key: const ValueKey('home-companies-count'),
                  style: AppTextStyles.body.copyWith(
                    color: context.colors.textSecondary,
                  ),
                ),
              ),
              _CompanySortButton(sort: sort, onChanged: onSortChanged),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.s12),
        Padding(
          padding: side,
          child: shown.isEmpty
              ? AppEmptyState(
                  icon: Icons.search_off_rounded,
                  message: l10n.homeNoCompanies,
                )
              : Column(
                  children: [
                    if (feature != null) ...[
                      _FeaturedCompany(
                        company: feature,
                        ratings: ratings,
                        tags: _tagsOf(context, feature),
                      ),
                      if (rest.isNotEmpty)
                        const SizedBox(height: AppSpacing.s12),
                    ],
                    for (var i = 0; i < rest.length; i++) ...[
                      _CompanyRow(
                        company: rest[i],
                        ratings: ratings,
                        tags: _tagsOf(context, rest[i]),
                      ),
                      if (i < rest.length - 1)
                        const SizedBox(height: AppSpacing.s12),
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  List<String> _tagsOf(BuildContext context, Company company) => [
    for (final id in topCategories[company.id] ?? const <String>[])
      if (categoriesById[id] != null)
        categoriesById[id]!.localizedName(context),
  ];
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: selected ? colors.bgInverse : colors.surface,
        shape: StadiumBorder(
          side: BorderSide(
            color: selected ? colors.bgInverse : colors.borderDefault,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            height: 40,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
            child: Text(
              label,
              style: AppTextStyles.labelLarge.copyWith(
                color: selected ? colors.textInverse : colors.textSecondary,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _companySortLabel(BuildContext context, CompanySort sort) {
  final l10n = context.l10n;
  return switch (sort) {
    CompanySort.topRated => l10n.homeSortTopRated,
    CompanySort.name => l10n.homeSortName,
    CompanySort.mostReviewed => l10n.homeSortMostReviewed,
  };
}

class _CompanySortButton extends StatelessWidget {
  const _CompanySortButton({required this.sort, required this.onChanged});

  final CompanySort sort;
  final ValueChanged<CompanySort> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final style = AppTextStyles.labelLarge.copyWith(
      color: colors.textBrand,
      fontWeight: FontWeight.w700,
    );
    return PopupMenuButton<CompanySort>(
      key: const ValueKey('home-company-sort'),
      initialValue: sort,
      onSelected: onChanged,
      tooltip: _companySortLabel(context, sort),
      position: PopupMenuPosition.under,
      itemBuilder: (context) => [
        for (final option in CompanySort.values)
          PopupMenuItem(
            value: option,
            child: Text(_companySortLabel(context, option)),
          ),
      ],
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.s8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.swap_vert_rounded,
              size: AppSize.iconMd,
              color: colors.textBrand,
            ),
            const SizedBox(width: AppSpacing.s4),
            Text(_companySortLabel(context, sort), style: style),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              size: AppSize.iconMd,
              color: colors.textBrand,
            ),
          ],
        ),
      ),
    );
  }
}

void _openCompany(BuildContext context, Company company) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => CompanyDetailsScreen(company: company),
    ),
  );
}

/// "4.8 ★ (31 reviews)" from the live ratings, or the figures stored on the
/// company until someone rates it.
class _RatingText extends StatelessWidget {
  const _RatingText({required this.company, required this.ratings});

  final Company company;
  final Map<String, RatingStats> ratings;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final rating = companyRating(company, ratings);
    if (rating.count == 0) {
      return Text(
        context.l10n.reviewsNew,
        style: AppTextStyles.captionStrong.copyWith(color: colors.textBrand),
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.star_rounded, color: colors.warning, size: AppSize.iconMd),
        const SizedBox(width: AppSpacing.s4),
        Text(
          rating.average.toStringAsFixed(1),
          style: AppTextStyles.bodyStrong,
        ),
        const SizedBox(width: AppSpacing.s6),
        Text(
          context.l10n.reviewsCount(rating.count),
          style: AppTextStyles.body.copyWith(color: colors.textSecondary),
        ),
      ],
    );
  }
}

/// Small grey labels, such as the categories a company works in.
class _Tags extends StatelessWidget {
  const _Tags({required this.tags});

  final List<String> tags;

  @override
  Widget build(BuildContext context) {
    if (tags.isEmpty) return const SizedBox.shrink();
    final colors = context.colors;
    return Wrap(
      spacing: AppSpacing.s6,
      runSpacing: AppSpacing.s6,
      children: [
        for (final tag in tags)
          DecoratedBox(
            decoration: BoxDecoration(
              color: colors.bgSubtle,
              borderRadius: AppRadius.smAll,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.s8,
                vertical: AppSpacing.s2,
              ),
              child: Text(
                tag,
                style: AppTextStyles.caption.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// The best rated company: a dark cover with its logo on the edge, name,
/// stars, categories and a button to its page.
class _FeaturedCompany extends StatelessWidget {
  const _FeaturedCompany({
    required this.company,
    required this.ratings,
    required this.tags,
  });

  final Company company;
  final Map<String, RatingStats> ratings;
  final List<String> tags;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = context.l10n;
    return Material(
      key: const ValueKey('home-featured-company'),
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.xl - 4),
        side: BorderSide(color: colors.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openCompany(context, company),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 116,
              child: Stack(
                children: [
                  const Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 68,
                    child: ColoredBox(color: HomePalette.heroNavy),
                  ),
                  PositionedDirectional(
                    top: AppSpacing.s12,
                    start: AppSpacing.s16,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: HomePalette.gold,
                        borderRadius: AppRadius.fullAll,
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.s12,
                          vertical: AppSpacing.s4,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.star_rounded,
                              size: AppSize.iconSm,
                              color: HomePalette.heroNavy,
                            ),
                            const SizedBox(width: AppSpacing.s4),
                            Text(
                              l10n.homeSortTopRated,
                              style: AppTextStyles.labelMedium.copyWith(
                                color: HomePalette.heroNavy,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  PositionedDirectional(
                    top: 36,
                    start: AppSpacing.s16,
                    child: Container(
                      padding: const EdgeInsets.all(AppSpacing.s4),
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: CompanyAvatar(
                        company: company,
                        size: 72,
                        shape: BoxShape.rectangle,
                        verified: false,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.s16,
                AppSpacing.s4,
                AppSpacing.s16,
                AppSpacing.s16,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          company.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.h2,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.s8),
                      const _VerifiedChip(),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.s8),
                  _RatingText(company: company, ratings: ratings),
                  if (tags.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.s8),
                    _Tags(tags: tags),
                  ],
                  const SizedBox(height: AppSpacing.s16),
                  AppButton.primary(
                    label: l10n.homeVisitCompany,
                    expand: true,
                    onPressed: () => _openCompany(context, company),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VerifiedChip extends StatelessWidget {
  const _VerifiedChip();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.brandPrimarySubtle,
        borderRadius: AppRadius.fullAll,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s8,
          vertical: AppSpacing.s2,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              context.l10n.homeCompanyVerified,
              style: AppTextStyles.labelMedium.copyWith(
                color: colors.textBrand,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: AppSpacing.s2),
            Icon(
              Icons.check_rounded,
              size: AppSize.iconSm,
              color: colors.textBrand,
            ),
          ],
        ),
      ),
    );
  }
}

/// A company in the list: its logo, name with the verified mark, stars and
/// categories.
class _CompanyRow extends StatelessWidget {
  const _CompanyRow({
    required this.company,
    required this.ratings,
    required this.tags,
  });

  final Company company;
  final Map<String, RatingStats> ratings;
  final List<String> tags;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      key: ValueKey('home-company-${company.id}'),
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.xl - 4),
        side: BorderSide(color: colors.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openCompany(context, company),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s12),
          child: Row(
            children: [
              CompanyAvatar(
                company: company,
                size: 64,
                shape: BoxShape.rectangle,
                verified: false,
              ),
              const SizedBox(width: AppSpacing.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            company.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.bodyLargeStrong,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.s4),
                        Icon(
                          Icons.verified_rounded,
                          size: AppSize.iconMd,
                          color: colors.primary,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.s4),
                    _RatingText(company: company, ratings: ratings),
                    if (tags.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.s6),
                      _Tags(tags: tags),
                    ],
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: colors.iconMuted),
            ],
          ),
        ),
      ),
    );
  }
}
