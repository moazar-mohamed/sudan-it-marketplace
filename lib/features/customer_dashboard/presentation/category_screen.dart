import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../categories/domain/category_tree.dart';
import '../../categories/domain/entities/category.dart';
import '../../categories/presentation/category_label.dart';
import '../../categories/presentation/category_providers.dart';
import '../../products/domain/entities/product.dart';
import '../../products/presentation/products_providers.dart';
import '../../products/presentation/widgets/product_grid_card.dart';
import '../../reviews/presentation/reviews_providers.dart';
import 'category_counts_provider.dart';
import 'widgets/category_browse.dart';
import 'widgets/home_design.dart';
import 'widgets/home_product_view.dart';
import 'widgets/home_products_section.dart';
import 'widgets/home_service_card.dart';
import 'widgets/home_service_view.dart';

/// One category on its own screen: where you are (the breadcrumb), the
/// sub-categories as chips with their counts, the filters, and the products
/// and services of the category (and everything under it) right below, so
/// nothing sits between choosing a category and seeing what is in it.
class CategoryScreen extends ConsumerStatefulWidget {
  const CategoryScreen({super.key, required this.categoryId});

  final String categoryId;

  @override
  ConsumerState<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends ConsumerState<CategoryScreen> {
  late String _currentId = widget.categoryId;
  BrowseFilters _filters = const BrowseFilters();
  ProductSort _sort = ProductSort.newest;

  void _go(String id) {
    setState(() {
      _currentId = id;
      // What was chosen in another category may not exist in this one.
      _filters = BrowseFilters(kind: _filters.kind);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tree = ref.watch(categoryTreeProvider);
    final counts = ref.watch(categoryCountsProvider);
    final current = tree.byId(_currentId);
    if (current == null || !tree.isEffectivelyActive(_currentId)) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: AppEmptyState(
            icon: Icons.category_outlined,
            message: l10n.categoryUnavailable,
          ),
        ),
      );
    }

    final scope = tree.subtreeIds(_currentId);
    final products = [
      for (final product in ref.watch(marketplaceProductsProvider))
        if (scope.contains(product.categoryId)) product,
    ];
    final listingsLoaded = ref.watch(performedServiceListingsProvider);
    final listings = [
      for (final listing in listingsLoaded ?? const <ServiceListing>[])
        if (scope.contains(listing.service.categoryId)) listing,
    ];

    final ratings = ref.watch(ratingsProvider).asData?.value ?? const {};
    final shownProducts = viewProducts(
      filterProducts(products, _filters),
      sort: _sort,
      filters: const ProductFilters(),
      ratings: ratings,
    );
    final shownListings = filterListings(listings, _filters);

    final categoriesById = ref.watch(categoriesByIdProvider);
    final categoryNames = ref.watch(categoryNamesProvider);
    final brands = brandsOf(products);
    final companies = _companiesOf(products, listings);
    final side = EdgeInsets.symmetric(
      horizontal: AppSpacing.screenMargin(MediaQuery.sizeOf(context).width),
    );
    final hasBoth = products.isNotEmpty && listings.isNotEmpty;
    final nothingHere = products.isEmpty && listings.isEmpty;
    final now = DateTime.now();

    return Scaffold(
      appBar: AppBar(title: Text(current.localizedName(context))),
      body: ListView(
        key: const ValueKey('category-screen'),
        padding: const EdgeInsets.only(bottom: AppSpacing.s24),
        children: [
          Padding(
            padding: side,
            child: _Breadcrumb(tree: tree, currentId: _currentId, onGo: _go),
          ),
          _SubChips(
            tree: tree,
            counts: counts,
            currentId: _currentId,
            onGo: _go,
            padding: side,
          ),
          if (!nothingHere) ...[
            const SizedBox(height: AppSpacing.s8),
            if (hasBoth)
              Padding(
                padding: side,
                child: AppFilterChips(
                  key: const ValueKey('category-kind-chips'),
                  labels: [
                    l10n.categoryKindAll,
                    l10n.categoryKindProducts,
                    l10n.categoryKindServices,
                  ],
                  selectedIndex: _filters.kind.index,
                  onChanged: (i) => setState(
                    () => _filters = _filters.copyWith(
                      kind: BrowseKind.values[i],
                    ),
                  ),
                ),
              ),
            if (hasBoth) const SizedBox(height: AppSpacing.s8),
            Padding(
              padding: side,
              child: _FilterBar(
                filters: _filters,
                sort: _sort,
                showSort: products.isNotEmpty,
                brands: brands,
                companies: companies,
                onSortChanged: (sort) => setState(() => _sort = sort),
                onChanged: (filters) => setState(() => _filters = filters),
              ),
            ),
            const SizedBox(height: AppSpacing.s16),
          ],
          if (nothingHere)
            Padding(
              padding: side,
              child: AppEmptyState(
                icon: Icons.inventory_2_outlined,
                message: l10n.categoryScreenEmpty,
              ),
            )
          else if (shownProducts.isEmpty && shownListings.isEmpty)
            Padding(
              padding: side,
              child: AppEmptyState(
                key: const ValueKey('category-no-matches'),
                icon: Icons.filter_alt_off_outlined,
                message: l10n.categoryNoMatches,
                action: AppButton.text(
                  label: l10n.categoryClearFilters,
                  onPressed: () =>
                      setState(() => _filters = _filters.cleared()),
                ),
              ),
            )
          else ...[
            if (shownProducts.isNotEmpty) ...[
              Padding(
                padding: side,
                child: Text(
                  l10n.categorySectionProducts(shownProducts.length),
                  style: AppTextStyles.h3,
                ),
              ),
              const SizedBox(height: AppSpacing.s12),
              Padding(
                padding: side,
                child: ProductsGrid(
                  children: [
                    for (final product in shownProducts)
                      _productCard(
                        product,
                        categoriesById,
                        categoryNames,
                        now,
                        context,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.s20),
            ],
            if (shownListings.isNotEmpty) ...[
              Padding(
                padding: side,
                child: Text(
                  l10n.categorySectionServices(shownListings.length),
                  style: AppTextStyles.h3,
                ),
              ),
              const SizedBox(height: AppSpacing.s12),
              Padding(
                padding: side,
                child: Column(
                  children: [
                    for (var i = 0; i < shownListings.length; i++) ...[
                      HomeServiceCard(
                        listing: shownListings[i],
                        category:
                            categoriesById[shownListings[i].service.categoryId],
                        categoryName:
                            categoryNames[shownListings[i].service.categoryId],
                      ),
                      if (i < shownListings.length - 1)
                        const SizedBox(height: AppSpacing.s12),
                    ],
                  ],
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _productCard(
    Product product,
    Map<String, Category> categoriesById,
    Map<String, String> categoryNames,
    DateTime now,
    BuildContext context,
  ) {
    final look = CategoryLook.of(
      categoriesById[product.categoryId],
      fallbackId: product.id,
    );
    return ProductGridCard(
      product: product,
      categoryName: categoryNames[product.categoryId],
      isNew: isNewProduct(product, now),
      tint: look.tint(context),
      icon: look.icon,
      iconColor: look.accent,
    );
  }
}

/// The companies behind [products] and [listings], by id, A to Z by name.
List<({String id, String name})> _companiesOf(
  List<Product> products,
  List<ServiceListing> listings,
) {
  final names = <String, String>{};
  for (final product in products) {
    final id = product.companyId;
    if (id != null && id.isNotEmpty) {
      names.putIfAbsent(id, () => product.companyName ?? id);
    }
  }
  for (final listing in listings) {
    for (final entry in listing.companies.entries) {
      names.putIfAbsent(entry.key, () => entry.value.name);
    }
  }
  return [for (final entry in names.entries) (id: entry.key, name: entry.value)]
    ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
}

/// "All categories > Printers > Laser": every part opens that category.
class _Breadcrumb extends StatelessWidget {
  const _Breadcrumb({
    required this.tree,
    required this.currentId,
    required this.onGo,
  });

  final CategoryTree tree;
  final String currentId;
  final ValueChanged<String> onGo;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final path = tree.pathOf(currentId);
    Widget crumb(String label, VoidCallback? onTap, {Key? key}) => TextButton(
      key: key,
      onPressed: onTap,
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s8),
        minimumSize: const Size(0, 36),
      ),
      child: Text(
        label,
        style: AppTextStyles.labelMedium.copyWith(
          color: onTap == null ? colors.textPrimary : colors.textBrand,
          fontWeight: onTap == null ? FontWeight.w700 : FontWeight.w600,
        ),
      ),
    );
    return Wrap(
      key: const ValueKey('category-breadcrumb'),
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        crumb(
          context.l10n.categoryRootCrumb,
          () => Navigator.of(context).pop(),
          key: const ValueKey('crumb-root'),
        ),
        for (final category in path) ...[
          Icon(
            Icons.chevron_right_rounded,
            size: AppSize.iconSm,
            color: colors.textSecondary,
            // Points the way the path reads, in both languages.
            textDirection: Directionality.of(context),
          ),
          crumb(
            category.localizedName(context),
            category.id == currentId ? null : () => onGo(category.id),
            key: ValueKey('crumb-${category.id}'),
          ),
        ],
      ],
    );
  }
}

/// The sub-categories as chips with what each holds, and "All" for the
/// category itself. A category with sub-categories lists them; a last-level
/// one lists its siblings so you can hop sideways.
class _SubChips extends StatelessWidget {
  const _SubChips({
    required this.tree,
    required this.counts,
    required this.currentId,
    required this.onGo,
    required this.padding,
  });

  final CategoryTree tree;
  final Map<String, CategoryCount>? counts;
  final String currentId;
  final ValueChanged<String> onGo;
  final EdgeInsets padding;

  List<Category> _shown(String? parentId) => [
    for (final category in tree.activeChildrenOf(parentId))
      if (counts == null || !(counts![category.id]?.isEmpty ?? true)) category,
  ];

  @override
  Widget build(BuildContext context) {
    final children = _shown(currentId);
    final String? parentId;
    final List<Category> chips;
    if (children.isNotEmpty) {
      parentId = currentId;
      chips = children;
    } else {
      parentId = tree.byId(currentId)?.parentId;
      chips = parentId == null ? const [] : _shown(parentId);
    }
    if (chips.isEmpty || parentId == null) return const SizedBox.shrink();
    final allLabel = context.l10n.categoryChipAll(
      counts?[parentId]?.total ?? 0,
    );
    final selectedIndex = parentId == currentId
        ? 0
        : 1 + chips.indexWhere((c) => c.id == currentId);
    return Padding(
      padding: padding.copyWith(top: AppSpacing.s4),
      child: AppFilterChips(
        key: const ValueKey('category-sub-chips'),
        labels: [
          if (counts == null) context.l10n.categoryKindAll else allLabel,
          for (final category in chips)
            counts == null
                ? category.localizedName(context)
                : '${category.localizedName(context)} (${counts![category.id]?.total ?? 0})',
        ],
        selectedIndex: selectedIndex < 0 ? 0 : selectedIndex,
        onChanged: (i) => onGo(i == 0 ? parentId! : chips[i - 1].id),
      ),
    );
  }
}

class _Choice<T> {
  const _Choice(this.value);

  final T value;
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.filters,
    required this.sort,
    required this.showSort,
    required this.brands,
    required this.companies,
    required this.onSortChanged,
    required this.onChanged,
  });

  final BrowseFilters filters;
  final ProductSort sort;
  final bool showSort;
  final List<String> brands;
  final List<({String id, String name})> companies;
  final ValueChanged<ProductSort> onSortChanged;
  final ValueChanged<BrowseFilters> onChanged;

  Future<void> _pickBrand(BuildContext context) async {
    final choice = await _pickOne<String?>(
      context,
      anyLabel: context.l10n.categoryFilterAnyBrand,
      options: [for (final brand in brands) (brand, brand)],
      selected: filters.brand,
    );
    if (choice == null) return;
    onChanged(
      choice.value == null
          ? filters.copyWith(clearBrand: true)
          : filters.copyWith(brand: choice.value),
    );
  }

  Future<void> _pickCompany(BuildContext context) async {
    final choice = await _pickOne<String?>(
      context,
      anyLabel: context.l10n.categoryFilterAnyCompany,
      options: [for (final company in companies) (company.id, company.name)],
      selected: filters.companyId,
    );
    if (choice == null) return;
    onChanged(
      choice.value == null
          ? filters.copyWith(clearCompany: true)
          : filters.copyWith(companyId: choice.value),
    );
  }

  Future<void> _pickPrice(BuildContext context) async {
    final choice = await showModalBottomSheet<_Choice<(double?, double?)>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _PriceSheet(min: filters.minPrice, max: filters.maxPrice),
    );
    if (choice == null) return;
    final (min, max) = choice.value;
    onChanged(filters.withPrice(min, max));
  }

  String _priceLabel(BuildContext context) {
    final l10n = context.l10n;
    final min = filters.minPrice;
    final max = filters.maxPrice;
    String n(double v) => v == v.roundToDouble() ? '${v.round()}' : '$v';
    if (min != null && max != null) return '${n(min)} - ${n(max)}';
    if (min != null) return '${l10n.categoryFilterPriceFrom} ${n(min)}';
    if (max != null) return '${l10n.categoryFilterPriceTo} ${n(max)}';
    return l10n.categoryFilterPrice;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Wrap(
      key: const ValueKey('category-filter-bar'),
      spacing: AppSpacing.s6,
      runSpacing: AppSpacing.s8,
      children: [
        if (showSort) HomeSortButton(sort: sort, onChanged: onSortChanged),
        HomeFilterChip(
          label: l10n.homeFilterOffers,
          selected: filters.offers,
          onTap: () => onChanged(filters.copyWith(offers: !filters.offers)),
        ),
        if (showSort)
          HomeFilterChip(
            label: l10n.categoryFilterInStock,
            selected: filters.inStock,
            onTap: () => onChanged(filters.copyWith(inStock: !filters.inStock)),
          ),
        if (brands.isNotEmpty)
          HomeFilterChip(
            label: filters.brand ?? l10n.categoryFilterBrand,
            selected: filters.brand != null,
            onTap: () => _pickBrand(context),
          ),
        HomeFilterChip(
          label: _priceLabel(context),
          selected: filters.hasPrice,
          onTap: () => _pickPrice(context),
        ),
        if (companies.length > 1 || filters.companyId != null)
          HomeFilterChip(
            label: _companyLabel(context),
            selected: filters.companyId != null,
            onTap: () => _pickCompany(context),
          ),
      ],
    );
  }

  String _companyLabel(BuildContext context) {
    final id = filters.companyId;
    if (id == null) return context.l10n.categoryFilterCompany;
    for (final company in companies) {
      if (company.id == id) return company.name;
    }
    return context.l10n.categoryFilterCompany;
  }
}

/// A sheet with "any" first and then [options] (value, label); returns the
/// choice (a null value means "any"), or null when dismissed.
Future<_Choice<T?>?> _pickOne<T>(
  BuildContext context, {
  required String anyLabel,
  required List<(T, String)> options,
  required T? selected,
}) {
  return showModalBottomSheet<_Choice<T?>>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.7,
        ),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.only(bottom: AppSpacing.s16),
          children: [
            ListTile(
              key: const ValueKey('filter-any'),
              title: Text(anyLabel),
              selected: selected == null,
              trailing: selected == null
                  ? const Icon(Icons.check_rounded)
                  : null,
              onTap: () => Navigator.of(sheetContext).pop(_Choice<T?>(null)),
            ),
            for (final option in options)
              ListTile(
                key: ValueKey('filter-option-${option.$1}'),
                title: Text(option.$2),
                selected: option.$1 == selected,
                trailing: option.$1 == selected
                    ? const Icon(Icons.check_rounded)
                    : null,
                onTap: () =>
                    Navigator.of(sheetContext).pop(_Choice<T?>(option.$1)),
              ),
          ],
        ),
      ),
    ),
  );
}

class _PriceSheet extends StatefulWidget {
  const _PriceSheet({required this.min, required this.max});

  final double? min;
  final double? max;

  @override
  State<_PriceSheet> createState() => _PriceSheetState();
}

class _PriceSheetState extends State<_PriceSheet> {
  late final TextEditingController _min = TextEditingController(
    text: widget.min == null ? '' : _text(widget.min!),
  );
  late final TextEditingController _max = TextEditingController(
    text: widget.max == null ? '' : _text(widget.max!),
  );

  static String _text(double v) =>
      v == v.roundToDouble() ? '${v.round()}' : '$v';

  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  void _apply() {
    var min = double.tryParse(_min.text.trim());
    var max = double.tryParse(_max.text.trim());
    if (min != null && max != null && min > max) {
      (min, max) = (max, min);
    }
    Navigator.of(context).pop(_Choice<(double?, double?)>((min, max)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final formatter = FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'));
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.s16,
        0,
        AppSpacing.s16,
        MediaQuery.viewInsetsOf(context).bottom + AppSpacing.s16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.categoryFilterPrice, style: AppTextStyles.h2),
          const SizedBox(height: AppSpacing.s12),
          Row(
            children: [
              Expanded(
                child: AppTextField(
                  key: const ValueKey('price-min'),
                  label: l10n.categoryFilterPriceFrom,
                  controller: _min,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [formatter],
                ),
              ),
              const SizedBox(width: AppSpacing.s12),
              Expanded(
                child: AppTextField(
                  key: const ValueKey('price-max'),
                  label: l10n.categoryFilterPriceTo,
                  controller: _max,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [formatter],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s16),
          Row(
            children: [
              Expanded(
                child: AppButton.outlined(
                  key: const ValueKey('price-clear'),
                  label: l10n.categoryFilterClear,
                  onPressed: () =>
                      Navigator.of(context)
                          .pop(const _Choice<(double?, double?)>((null, null))),
                ),
              ),
              const SizedBox(width: AppSpacing.s12),
              Expanded(
                child: AppButton.primary(
                  key: const ValueKey('price-apply'),
                  label: l10n.categoryFilterApply,
                  onPressed: _apply,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
