import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/localization/locale_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/search_ranking.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../categories/presentation/category_label.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../cities/presentation/city_providers.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../company_services/domain/entities/company_service.dart';
import '../../../company_services/presentation/company_service_providers.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/reviews_providers.dart';
import '../../../search/presentation/marketplace_search.dart';
import '../../../services/domain/entities/catalog_service.dart';
import '../../../services/presentation/service_providers.dart';
import '../category_counts_provider.dart';
import '../widgets/home_service_view.dart';
import 'site_cards.dart';
import 'site_look.dart';

/// Which tab of the site's browse page: products or services.
enum SiteBrowseKind { products, services }

/// How the site orders products (`ProductSort` in customer_web/src/data/browse.ts).
enum SiteProductSort { newest, priceLow, priceHigh, topRated }

/// What narrows the browse page (`BrowseFilters` on the site, without the
/// price range the site does not offer).
@immutable
class SiteBrowseFilters {
  const SiteBrowseFilters({
    this.kind = SiteBrowseKind.products,
    this.offers = false,
    this.inStock = false,
    this.delivery = false,
    this.installation = false,
    this.topRated = false,
    this.brand,
    this.companyId,
  });

  final SiteBrowseKind kind;
  final bool offers;
  final bool inStock;
  final bool delivery;
  final bool installation;
  final bool topRated;
  final String? brand;
  final String? companyId;

  /// Whether anything but the kind narrows the list.
  bool get active =>
      offers ||
      inStock ||
      delivery ||
      installation ||
      topRated ||
      brand != null ||
      companyId != null;

  SiteBrowseFilters copyWith({
    bool? offers,
    bool? inStock,
    bool? delivery,
    bool? installation,
    bool? topRated,
    String? Function()? brand,
    String? Function()? companyId,
  }) => SiteBrowseFilters(
    kind: kind,
    offers: offers ?? this.offers,
    inStock: inStock ?? this.inStock,
    delivery: delivery ?? this.delivery,
    installation: installation ?? this.installation,
    topRated: topRated ?? this.topRated,
    brand: brand == null ? this.brand : brand(),
    companyId: companyId == null ? this.companyId : companyId(),
  );

  /// Everything cleared, the tab kept.
  SiteBrowseFilters cleared() => SiteBrowseFilters(kind: kind);
}

String _brandKey(String brand) => brand.trim().toLowerCase();

double _average(RatingStats? stats) =>
    stats == null || stats.count == 0 ? 0 : stats.sum / stats.count;

/// A product counts as top rated from this average (it needs a rating).
const _topRatedFrom = 4.0;

/// [products] the filters keep (`filterProducts`): none on the services tab.
List<Product> siteFilterProducts(
  List<Product> products,
  SiteBrowseFilters f,
  Map<String, RatingStats> ratings,
) {
  if (f.kind == SiteBrowseKind.services) return const [];
  final brand = f.brand == null ? null : _brandKey(f.brand!);
  return [
    for (final p in products)
      if ((!f.offers || p.hasActiveOffer) &&
          (!f.inStock || p.isAvailable) &&
          (!f.delivery || p.isDeliveryAvailable) &&
          (!f.installation || p.isInstallationAvailable) &&
          (!f.topRated ||
              _average(ratings[RatingStats.keyFor('product', p.id)]) >=
                  _topRatedFrom) &&
          (brand == null || _brandKey(p.brand) == brand) &&
          (f.companyId == null || p.companyId == f.companyId))
        p,
  ];
}

/// [listings] the filters keep (`filterListings`): only on the services tab,
/// and not while a product-only filter is on.
List<ServiceListing> siteFilterListings(
  List<ServiceListing> listings,
  SiteBrowseFilters f,
) {
  final showsServices =
      f.kind == SiteBrowseKind.services &&
      !f.inStock &&
      f.brand == null &&
      !f.delivery &&
      !f.installation &&
      !f.topRated;
  if (!showsServices) return const [];
  return [
    for (final l in listings)
      if ((!f.offers || l.bestDiscount > 0) &&
          (f.companyId == null ||
              l.offers.any((o) => o.companyId == f.companyId)))
        l,
  ];
}

/// [products] in [sort] order; with [serves] and the newest order, the
/// products of companies that serve the customer's city come first.
List<Product> siteSortProducts(
  List<Product> products,
  SiteProductSort sort,
  Map<String, RatingStats> ratings, {
  bool Function(Product)? serves,
}) {
  int nulls(Object? a, Object? b) => a == null ? 1 : (b == null ? -1 : 0);
  final cityFirst = serves != null && sort == SiteProductSort.newest;
  final indexed = products.indexed.toList();
  indexed.sort((x, y) {
    final a = x.$2;
    final b = y.$2;
    if (cityFirst) {
      final diff = (serves(a) ? 0 : 1) - (serves(b) ? 0 : 1);
      if (diff != 0) return diff;
    }
    var order = 0;
    switch (sort) {
      case SiteProductSort.newest:
        final ca = a.createdAt;
        final cb = b.createdAt;
        order = ca == null || cb == null
            ? (ca == cb ? 0 : nulls(ca, cb))
            : cb.compareTo(ca);
      case SiteProductSort.priceLow:
      case SiteProductSort.priceHigh:
        final pa = a.salePrice;
        final pb = b.salePrice;
        if (pa == null || pb == null) {
          order = pa == pb ? 0 : nulls(pa, pb);
        } else {
          order = sort == SiteProductSort.priceLow
              ? pa.compareTo(pb)
              : pb.compareTo(pa);
        }
      case SiteProductSort.topRated:
        final sa = ratings[RatingStats.keyFor('product', a.id)];
        final sb = ratings[RatingStats.keyFor('product', b.id)];
        order = _average(sb).compareTo(_average(sa));
        if (order == 0) order = (sb?.count ?? 0).compareTo(sa?.count ?? 0);
    }
    return order != 0 ? order : x.$1.compareTo(y.$1);
  });
  return [for (final (_, p) in indexed) p];
}

/// The brands of [products], each once (spelled as first met), A to Z.
List<String> siteBrandsOf(Iterable<Product> products) {
  final byKey = <String, String>{};
  for (final p in products) {
    final brand = p.brand.trim();
    if (brand.isNotEmpty) byKey.putIfAbsent(_brandKey(brand), () => brand);
  }
  return byKey.values.toList()
    ..sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
}

/// The companies behind [products] and [listings], A to Z, as (id, name).
List<(String, String)> siteCompaniesOf(
  List<Product> products,
  List<ServiceListing> listings,
) {
  final names = <String, String>{};
  for (final p in products) {
    final id = p.companyId ?? '';
    if (id.isNotEmpty) names.putIfAbsent(id, () => p.companyName ?? id);
  }
  for (final l in listings) {
    for (final entry in l.companies.entries) {
      names.putIfAbsent(entry.key, () => entry.value.name);
    }
  }
  return names.entries.map((e) => (e.key, e.value)).toList()
    ..sort((a, b) => a.$2.toLowerCase().compareTo(b.$2.toLowerCase()));
}

/// The items of [items] that match [query], in their own order (the page's
/// own search box narrows what the page shows and keeps its sort).
List<T> siteNarrow<T>(
  List<T> items,
  String query,
  List<SearchField> Function(T) fieldsOf,
) {
  if (query.trim().isEmpty) return items;
  final hits = searchRanked(items, query, fieldsOf).toSet();
  return [
    for (final item in items)
      if (hits.contains(item)) item,
  ];
}

const _pageSize = 24;
const _viewKey = 'sudan-it-products-view';

/// sictm.net's products / services page (`BrowsePage`): the strip of main
/// categories, the sub-categories, the page's own search, the filters and
/// the sort, the active filters with the count and the grid / list choice,
/// then the cards 24 at a time. The category chosen lives in [category], so
/// the home's category cards can open the page on one.
class SiteBrowsePage extends ConsumerStatefulWidget {
  const SiteBrowsePage({super.key, required this.kind, this.category});

  final SiteBrowseKind kind;
  final ValueNotifier<String?>? category;

  @override
  ConsumerState<SiteBrowsePage> createState() => _SiteBrowsePageState();
}

class _SiteBrowsePageState extends ConsumerState<SiteBrowsePage> {
  late final ValueNotifier<String?> _category =
      widget.category ?? ValueNotifier<String?>(null);
  late SiteBrowseFilters _filters = SiteBrowseFilters(kind: widget.kind);
  SiteProductSort _sort = SiteProductSort.newest;
  final _query = TextEditingController();
  int _limit = _pageSize;
  bool? _list;

  @override
  void initState() {
    super.initState();
    _category.addListener(_onCategory);
  }

  @override
  void dispose() {
    _category.removeListener(_onCategory);
    if (widget.category == null) _category.dispose();
    _query.dispose();
    super.dispose();
  }

  void _onCategory() {
    if (mounted) setState(() => _limit = _pageSize);
  }

  void _open(String? id) {
    _category.value = id;
  }

  void _setFilters(SiteBrowseFilters next) => setState(() {
    _filters = next;
    _limit = _pageSize;
  });

  void _clear() => setState(() {
    _filters = _filters.cleared();
    _query.clear();
    _limit = _pageSize;
  });

  bool _listView() {
    final saved = _list;
    if (saved != null) return saved;
    return ref.read(sharedPreferencesProvider)?.getString(_viewKey) == 'list';
  }

  void _chooseView(bool list) {
    setState(() => _list = list);
    ref
        .read(sharedPreferencesProvider)
        ?.setString(_viewKey, list ? 'list' : 'grid');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final tree = ref.watch(categoryTreeProvider);
    final categoriesById = ref.watch(categoriesByIdProvider);
    final counts = ref.watch(categoryCountsProvider);
    final allProducts = ref.watch(marketplaceProductsProvider);
    final loading =
        ref.watch(firestoreProductsStreamProvider).isLoading &&
        allProducts.isEmpty;
    final companies = ref.watch(marketplaceCompaniesProvider);
    final services =
        ref.watch(marketplaceServicesProvider).asData?.value ??
        const <CatalogService>[];
    final links =
        ref.watch(allActiveCompanyServicesProvider).asData?.value ??
        const <CompanyService>[];
    final allListings = buildServiceListings(
      services: services,
      links: links,
      companies: companies,
    ).where((l) => l.offers.isNotEmpty).toList();
    final ratings =
        ref.watch(ratingsProvider).asData?.value ??
        const <String, RatingStats>{};
    final cityId = ref.watch(cityFilterProvider);
    final serving = {
      for (final c in companies)
        if (c.servesCity(cityId)) c.id,
    };

    final id = _category.value;
    final current = tree.byId(id);
    if (id != null && (current == null || !tree.isEffectivelyActive(id))) {
      return _Page(
        children: [
          SiteEmptyState(
            title: l10n.siteCategoryUnavailable,
            message: l10n.siteCategoryUnavailableBody,
            actionLabel: l10n.siteBrowseAll,
            onAction: () => _open(null),
          ),
        ],
      );
    }
    final scope = id == null ? null : tree.subtreeIds(id);
    final products = scope == null
        ? allProducts
        : [
            for (final p in allProducts)
              if (p.categoryId != null && scope.contains(p.categoryId)) p,
          ];
    final listings = scope == null
        ? allListings
        : [
            for (final l in allListings)
              if (scope.contains(l.service.categoryId)) l,
          ];
    final query = _query.text;
    final shownProducts = siteNarrow(
      siteSortProducts(
        siteFilterProducts(products, _filters, ratings),
        _sort,
        ratings,
        serves: cityId == null
            ? null
            : (p) =>
                  (p.companyId ?? '').isEmpty || serving.contains(p.companyId),
      ),
      query,
      (p) => productSearchFields(p, categoriesById),
    );
    final shownListings = siteNarrow(
      siteFilterListings(listings, _filters),
      query,
      (l) => [
        ...serviceSearchFields(l.service, categoriesById),
        SearchField(l.companies.values.map((c) => c.name).join(' ')),
      ],
    );
    final brands = siteBrandsOf(products);
    final companyOptions = siteCompaniesOf(products, listings);
    final services_ = _filters.kind == SiteBrowseKind.services;
    final nothingHere = services_ ? listings.isEmpty : products.isEmpty;
    final nothingMatches = shownProducts.isEmpty && shownListings.isEmpty;
    final productFilters = !services_ && products.isNotEmpty;
    final list = _listView();

    final roots = tree.activeChildrenOf(null);
    final path = current == null ? const <Category>[] : tree.pathOf(current.id);
    final children = id == null
        ? const <Category>[]
        : tree.activeChildrenOf(id);
    final chipParent = children.isNotEmpty ? id : current?.parentId;
    final chips = children.isNotEmpty
        ? children
        : current?.parentId != null
        ? tree.activeChildrenOf(current!.parentId)
        : const <Category>[];
    int count(String? categoryId) => counts?[categoryId]?.total ?? 0;

    String sortLabel(SiteProductSort s) => switch (s) {
      SiteProductSort.newest => l10n.siteSortNewest,
      SiteProductSort.priceLow => l10n.siteSortPriceLow,
      SiteProductSort.priceHigh => l10n.siteSortPriceHigh,
      SiteProductSort.topRated => l10n.siteSortTopRated,
    };

    final toggles =
        <(String, String, bool, bool, SiteBrowseFilters Function(bool))>[
          (
            'offers',
            l10n.siteFilterOffers,
            _filters.offers,
            true,
            (v) => _filters.copyWith(offers: v),
          ),
          (
            'stock',
            l10n.siteFilterInStock,
            _filters.inStock,
            productFilters,
            (v) => _filters.copyWith(inStock: v),
          ),
          (
            'delivery',
            l10n.siteDelivery,
            _filters.delivery,
            productFilters,
            (v) => _filters.copyWith(delivery: v),
          ),
          (
            'install',
            l10n.siteInstallation,
            _filters.installation,
            productFilters,
            (v) => _filters.copyWith(installation: v),
          ),
          (
            'rated',
            l10n.siteSortTopRated,
            _filters.topRated,
            productFilters,
            (v) => _filters.copyWith(topRated: v),
          ),
        ];
    final companyName =
        companyOptions
            .where((c) => c.$1 == _filters.companyId)
            .map((c) => c.$2)
            .firstOrNull ??
        _filters.companyId;
    final tags = <(String, VoidCallback)>[
      for (final t in toggles)
        if (t.$3) (t.$2, () => _setFilters(t.$5(false))),
      if (_filters.brand != null)
        (
          _filters.brand!,
          () => _setFilters(_filters.copyWith(brand: () => null)),
        ),
      if (_filters.companyId != null)
        (
          companyName ?? '',
          () => _setFilters(_filters.copyWith(companyId: () => null)),
        ),
    ];

    Widget row(List<Widget> items) => SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) => Center(child: items[i]),
      ),
    );

    final results = <Widget>[];
    if (nothingHere) {
      results.add(
        SiteEmptyState(
          title: id != null
              ? (services_
                    ? l10n.siteNoServicesInCategory
                    : l10n.siteNoProductsInCategory)
              : l10n.siteNothingYet,
        ),
      );
    }

    return _Page(
      key: ValueKey('site-browse-${widget.kind.name}'),
      bleed: [
        // The main categories, in a strip (`.cat-strip`).
        SizedBox(
          // As tall as the site's cards: a long name shows in full (four lines).
          height:
              160 * MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.6),
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _StripCategory(
                key: const ValueKey('browse-cat-all'),
                label: l10n.siteAllCategories,
                selected: id == null,
                onTap: () => _open(null),
              ),
              for (final c in roots)
                _StripCategory(
                  key: ValueKey('browse-cat-${c.id}'),
                  label: c.localizedName(context),
                  category: c,
                  selected: path.isNotEmpty && path.first.id == c.id,
                  onTap: () => _open(c.id),
                ),
            ],
          ),
        ),
        if (path.length > 2)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: _Crumbs(
              items: [
                (l10n.siteAllCategories, () => _open(null)),
                for (final c in path)
                  (
                    c.localizedName(context),
                    c.id == id ? null : () => _open(c.id),
                  ),
              ],
            ),
          ),
        if (chips.isNotEmpty) ...[
          const SizedBox(height: 16),
          row([
            SiteChip(
              key: const ValueKey('browse-sub-all'),
              small: true,
              selected: chipParent == id,
              label: chipParent != null && counts != null
                  ? l10n.siteWholeCategoryCount(count(chipParent))
                  : l10n.siteWholeCategory,
              onTap: () => _open(chipParent),
            ),
            for (final c in chips)
              SiteChip(
                key: ValueKey('browse-sub-${c.id}'),
                small: true,
                selected: c.id == id,
                label: counts != null
                    ? l10n.siteCategoryWithCount(
                        c.localizedName(context),
                        count(c.id),
                      )
                    : c.localizedName(context),
                onTap: () => _open(c.id),
              ),
          ]),
        ],
      ],
      children: [
        if (loading)
          const AppSkeletonList(count: 2)
        else if (nothingHere)
          ...results
        else ...[
          SitePageSearch(
            controller: _query,
            hint: current != null
                ? l10n.siteSearchInCategory(current.localizedName(context))
                : l10n.siteSearchProductsServices,
            onChanged: (_) => setState(() => _limit = _pageSize),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: EdgeInsets.zero,
            child: SizedBox(
              height: 42,
              child: ListView(
                key: const ValueKey('browse-filters'),
                scrollDirection: Axis.horizontal,
                children: [
                  for (final t in toggles)
                    if (t.$4)
                      Padding(
                        padding: const EdgeInsetsDirectional.only(end: 8),
                        child: Center(
                          child: SiteChip(
                            key: ValueKey('browse-filter-${t.$1}'),
                            label: t.$2,
                            selected: t.$3,
                            onTap: () => _setFilters(t.$5(!t.$3)),
                          ),
                        ),
                      ),
                  if (productFilters && brands.isNotEmpty)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: Center(
                        child: SiteMenuPill<String?>(
                          key: const ValueKey('browse-brand'),
                          label: _filters.brand ?? l10n.siteFilterBrand,
                          active: _filters.brand != null,
                          value: _filters.brand,
                          options: [
                            (null, l10n.siteFilterBrand),
                            for (final b in brands) (b, b),
                          ],
                          onChanged: (b) =>
                              _setFilters(_filters.copyWith(brand: () => b)),
                        ),
                      ),
                    ),
                  if (companyOptions.length > 1 || _filters.companyId != null)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: Center(
                        child: SiteMenuPill<String?>(
                          key: const ValueKey('browse-company'),
                          label: _filters.companyId == null
                              ? l10n.siteFilterCompany
                              : (companyName ?? l10n.siteFilterCompany),
                          active: _filters.companyId != null,
                          value: _filters.companyId,
                          options: [
                            (null, l10n.siteFilterCompany),
                            for (final (cid, name) in companyOptions)
                              (cid, name),
                          ],
                          onChanged: (c) => _setFilters(
                            _filters.copyWith(companyId: () => c),
                          ),
                        ),
                      ),
                    ),
                  if (productFilters)
                    Center(
                      child: SiteMenuPill<SiteProductSort>(
                        key: const ValueKey('browse-sort'),
                        label: sortLabel(_sort),
                        value: _sort,
                        options: [
                          for (final s in SiteProductSort.values)
                            (s, sortLabel(s)),
                        ],
                        onChanged: (s) => setState(() => _sort = s),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    for (final (label, onRemove) in tags)
                      Semantics(
                        button: true,
                        label: l10n.siteRemoveTag(label),
                        excludeSemantics: true,
                        child: Material(
                          color: colors.bgSubtle,
                          shape: const StadiumBorder(),
                          child: InkWell(
                            customBorder: const StadiumBorder(),
                            onTap: onRemove,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 5,
                              ),
                              child: Text(
                                '$label ✕',
                                style: AppTextStyles.captionStrong.copyWith(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: colors.textBrand,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    if (_filters.active)
                      InkWell(
                        key: const ValueKey('browse-clear-all'),
                        onTap: _clear,
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Text(
                            l10n.siteClearAll,
                            style: AppTextStyles.bodyStrong.copyWith(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: colors.textBrand,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Text(
                [
                  if (shownProducts.isNotEmpty)
                    l10n.siteProductsCount(shownProducts.length),
                  if (shownListings.isNotEmpty)
                    l10n.siteServicesCount(shownListings.length),
                ].join(' · '),
                key: const ValueKey('browse-count'),
                style: AppTextStyles.caption.copyWith(
                  fontSize: 13,
                  color: colors.textSecondary,
                ),
              ),
              if (shownProducts.isNotEmpty) ...[
                const SizedBox(width: 10),
                _ViewButton(
                  key: const ValueKey('browse-view-grid'),
                  icon: Icons.grid_view_rounded,
                  tooltip: l10n.siteGridView,
                  selected: !list,
                  onTap: () => _chooseView(false),
                ),
                const SizedBox(width: 4),
                _ViewButton(
                  key: const ValueKey('browse-view-list'),
                  icon: Icons.view_list_rounded,
                  tooltip: l10n.siteListView,
                  selected: list,
                  onTap: () => _chooseView(true),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
          if (nothingMatches)
            SiteEmptyState(
              title: query.trim().isNotEmpty
                  ? l10n.siteNoResultsHere(query.trim())
                  : l10n.siteNothingMatches,
              actionLabel: l10n.siteClearFilters,
              onAction: _clear,
            )
          else ...[
            for (var i = 0; i < shownProducts.length && i < _limit; i++) ...[
              if (i > 0) SizedBox(height: list ? 12 : 16),
              SiteProductCard(
                product: shownProducts[i],
                highlight: query,
                list: list,
              ),
            ],
            if (shownProducts.length > _limit) ...[
              const SizedBox(height: 16),
              Center(
                child: SiteActionPill(
                  key: const ValueKey('browse-more'),
                  label: l10n.siteShowMore,
                  onTap: () => setState(() => _limit += _pageSize),
                ),
              ),
            ],
            if (shownListings.isNotEmpty) ...[
              if (shownProducts.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  l10n.siteServicesHeading(shownListings.length),
                  style: AppTextStyles.h2.copyWith(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
              for (var i = 0; i < shownListings.length; i++) ...[
                if (i > 0 || shownProducts.isNotEmpty)
                  const SizedBox(height: 12),
                SiteServiceCard(listing: shownListings[i], highlight: query),
              ],
            ],
          ],
        ],
      ],
    );
  }
}

/// The page's scrolling list: [bleed] reaches the screen edges (the
/// strips), [children] keep the site's 16 px sides.
class _Page extends StatelessWidget {
  const _Page({super.key, this.bleed = const [], required this.children});

  final List<Widget> bleed;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return ListView(
      primary: false,
      padding: const EdgeInsets.only(top: 20, bottom: 32),
      children: [
        ...bleed,
        if (bleed.isNotEmpty) const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          ),
        ),
      ],
    );
  }
}

/// A main category in the strip (`.cat-strip .cat`): navy when chosen, else
/// its colour's light tint.
class _StripCategory extends StatelessWidget {
  const _StripCategory({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.category,
  });

  final String label;
  final Category? category;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final tint = category == null
        ? colors.surface
        : siteCategoryColor(category).withValues(alpha: 0.12);
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 10),
      child: Semantics(
        button: true,
        selected: selected,
        child: Material(
          color: selected ? colors.bgInverse : tint,
          borderRadius: BorderRadius.circular(18),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              width: 88,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 6,
                  vertical: 12,
                ),
                child: Column(
                  children: [
                    if (category == null)
                      Icon(
                        Icons.grid_view_rounded,
                        size: 24,
                        color: selected
                            ? colors.textInverse
                            : colors.textPrimary,
                      )
                    else
                      SiteGlyph(emoji: siteCategoryEmoji(category), size: 26),
                    const SizedBox(height: 6),
                    Text(
                      label,
                      textAlign: TextAlign.center,
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.captionStrong.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        height: 1.3,
                        color: selected
                            ? colors.textInverse
                            : colors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// «كل الأقسام / الشبكات / ...» (`Breadcrumbs`).
class _Crumbs extends StatelessWidget {
  const _Crumbs({required this.items});

  final List<(String, VoidCallback?)> items;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final style = AppTextStyles.body.copyWith(
      fontSize: 14,
      color: colors.textSecondary,
    );
    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) Text('/', style: style),
          if (items[i].$2 == null)
            Text(
              items[i].$1,
              style: style.copyWith(
                fontWeight: FontWeight.w700,
                color: colors.textPrimary,
              ),
            )
          else
            InkWell(
              onTap: items[i].$2,
              child: Text(
                items[i].$1,
                style: style.copyWith(color: colors.textBrand),
              ),
            ),
        ],
      ],
    );
  }
}

/// A square of the grid / list choice (`.view-toggle button`).
class _ViewButton extends StatelessWidget {
  const _ViewButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Tooltip(
      message: tooltip,
      child: Semantics(
        button: true,
        selected: selected,
        label: tooltip,
        excludeSemantics: true,
        child: Material(
          color: selected ? colors.primary : colors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: BorderSide(
              color: selected ? colors.primary : colors.borderDefault,
            ),
          ),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 34,
              height: 34,
              child: Icon(
                icon,
                size: 18,
                color: selected ? Colors.white : colors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
