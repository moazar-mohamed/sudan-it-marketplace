import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/presentation/category_label.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../cities/presentation/city_providers.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../company_services/domain/entities/company_service.dart';
import '../../../company_services/presentation/company_service_providers.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/reviews_providers.dart';
import '../../../search/presentation/marketplace_search.dart';
import '../../../services/domain/entities/catalog_service.dart';
import '../../../services/presentation/service_providers.dart';
import '../widgets/home_company_view.dart';
import '../widgets/home_service_view.dart';
import 'site_browse.dart';
import 'site_cards.dart';
import 'site_look.dart';

/// How the site orders companies (`CompanySort`).
enum SiteCompanySort { topRated, mostReviewed, name }

/// [companies] as the site lists them (`viewCompanies`): those working in
/// [categoryId] (a main category) when one is chosen, in [sort] order, the
/// ones that serve [cityId] first.
List<Company> siteViewCompanies(
  List<Company> companies,
  SiteCompanySort sort,
  Map<String, RatingStats> ratings,
  Map<String, List<String>> categoriesOf,
  String? categoryId,
  String? cityId,
) {
  (double, int) rating(Company c) {
    final s = ratings[RatingStats.keyFor('company', c.id)];
    return s != null && s.count > 0
        ? (s.sum / s.count, s.count)
        : (c.rating, c.reviewCount);
  }

  final kept = [
    for (final c in companies)
      if (categoryId == null ||
          (categoriesOf[c.id] ?? const []).contains(categoryId))
        c,
  ];
  final indexed = kept.indexed.toList()
    ..sort((x, y) {
      final a = rating(x.$2);
      final b = rating(y.$2);
      final order = switch (sort) {
        SiteCompanySort.topRated =>
          b.$1.compareTo(a.$1) != 0
              ? b.$1.compareTo(a.$1)
              : b.$2.compareTo(a.$2),
        SiteCompanySort.mostReviewed => b.$2.compareTo(a.$2),
        SiteCompanySort.name => x.$2.name.toLowerCase().compareTo(
          y.$2.name.toLowerCase(),
        ),
      };
      return order != 0 ? order : x.$1.compareTo(y.$1);
    });
  final ordered = [for (final (_, c) in indexed) c];
  if (cityId == null) return ordered;
  return [
    ...ordered.where((c) => c.servesCity(cityId)),
    ...ordered.where((c) => !c.servesCity(cityId)),
  ];
}

/// sictm.net's companies page (`CompaniesPage`): the title card with the main
/// categories the companies work in, the page's own search, the count with
/// the sort, then the company cards.
class SiteCompaniesPage extends ConsumerStatefulWidget {
  const SiteCompaniesPage({super.key});

  @override
  ConsumerState<SiteCompaniesPage> createState() => _SiteCompaniesPageState();
}

class _SiteCompaniesPageState extends ConsumerState<SiteCompaniesPage> {
  SiteCompanySort _sort = SiteCompanySort.topRated;
  String? _category;
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final companies = ref.watch(marketplaceCompaniesProvider);
    final loading =
        ref.watch(firestoreCompaniesStreamProvider).isLoading &&
        companies.isEmpty;
    final tree = ref.watch(categoryTreeProvider);
    final products = ref.watch(marketplaceProductsProvider);
    final services =
        ref.watch(marketplaceServicesProvider).asData?.value ??
        const <CatalogService>[];
    final links =
        ref.watch(allActiveCompanyServicesProvider).asData?.value ??
        const <CompanyService>[];
    final ratings =
        ref.watch(ratingsProvider).asData?.value ??
        const <String, RatingStats>{};
    final cityId = ref.watch(cityFilterProvider);
    final categoriesOf = companyTopCategories(
      tree: tree,
      products: products,
      links: links,
      services: services,
    );
    final shown = siteNarrow(
      siteViewCompanies(
        companies,
        _sort,
        ratings,
        categoriesOf,
        _category,
        cityId,
      ),
      _query.text,
      companySearchFields,
    );
    final chips = [
      for (final c in tree.childrenOf(null))
        if (categoriesOf.values.any((ids) => ids.contains(c.id))) c,
    ];
    final itemCounts = <String, int>{};
    for (final p in products) {
      final id = p.companyId ?? '';
      itemCounts[id] = (itemCounts[id] ?? 0) + 1;
    }
    for (final l in buildServiceListings(
      services: services,
      links: links,
      companies: companies,
    )) {
      for (final o in l.offers) {
        itemCounts[o.companyId] = (itemCounts[o.companyId] ?? 0) + 1;
      }
    }
    String sortLabel(SiteCompanySort s) => switch (s) {
      SiteCompanySort.topRated => l10n.siteSortTopRated,
      SiteCompanySort.mostReviewed => l10n.siteSortMostReviewed,
      SiteCompanySort.name => l10n.siteSortName,
    };

    return ListView(
      key: const ValueKey('site-companies'),
      primary: false,
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      children: [
        Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.borderDefault),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(
                  l10n.navCompanies,
                  style: AppTextStyles.h1.copyWith(
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (chips.isNotEmpty) ...[
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    SiteChip(
                      key: const ValueKey('companies-cat-all'),
                      label: l10n.siteAll,
                      selected: _category == null,
                      onTap: () => setState(() => _category = null),
                    ),
                    for (final c in chips)
                      SiteChip(
                        key: ValueKey('companies-cat-${c.id}'),
                        label: c.localizedName(context),
                        selected: _category == c.id,
                        onTap: () => setState(() => _category = c.id),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        SitePageSearch(
          controller: _query,
          hint: l10n.siteSearchCompany,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 16),
        // The count, then the sort; on a narrow screen the sort wraps below.
        LayoutBuilder(
          builder: (context, constraints) => Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 12,
            runSpacing: 8,
            children: [
              Text(
                l10n.siteCompaniesCount(shown.length),
                key: const ValueKey('companies-count'),
                style: AppTextStyles.caption.copyWith(
                  fontSize: 13,
                  color: colors.textSecondary,
                ),
              ),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  Text(
                    l10n.siteSortColon,
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 13,
                      color: colors.textSecondary,
                    ),
                  ),
                  SiteMenuPill<SiteCompanySort>(
                    key: const ValueKey('companies-sort'),
                    label: sortLabel(_sort),
                    value: _sort,
                    maxWidth: constraints.maxWidth,
                    options: [
                      for (final s in SiteCompanySort.values) (s, sortLabel(s)),
                    ],
                    onChanged: (s) => setState(() => _sort = s),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (loading)
          const AppSkeletonList(count: 2)
        else if (shown.isEmpty)
          SiteEmptyState(
            title: _query.text.trim().isNotEmpty
                ? l10n.siteNoResultsHere(_query.text.trim())
                : l10n.siteNoCompaniesHere,
          )
        else
          for (var i = 0; i < shown.length; i++) ...[
            if (i > 0) const SizedBox(height: 16),
            SiteCompanyCard(
              company: shown[i],
              itemCount: itemCounts[shown[i].id] ?? 0,
              highlight: _query.text,
            ),
          ],
      ],
    );
  }
}
