import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/search_ranking.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../companies/presentation/widgets/company_card.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/widgets/product_card.dart';
import '../../../services/presentation/service_providers.dart';
import '../../../services/presentation/widgets/service_card.dart';
import 'category_grid.dart';
import '../../../../core/localization/l10n_extension.dart';

class DashboardHomeTab extends ConsumerStatefulWidget {
  const DashboardHomeTab({super.key, this.onSelectTab});

  final ValueChanged<int>? onSelectTab;

  @override
  ConsumerState<DashboardHomeTab> createState() => _DashboardHomeTabState();
}

enum _HomeTab { products, services, companies }

class _DashboardHomeTabState extends ConsumerState<DashboardHomeTab> {
  final TextEditingController _searchController = TextEditingController();

  // Owned by this tab so it never binds to the ambient PrimaryScrollController,
  // which the sibling IndexedStack tabs also attach to.
  final ScrollController _scrollController = ScrollController();
  Timer? _searchDebounce;

  /// What the customer has typed (drives the clear button at once) and the
  /// same text once they pause, which is what the lists filter by.
  bool _hasSearchText = false;
  String _searchQuery = '';
  String? _categoryFilter;
  _HomeTab _selectedTab = _HomeTab.products;

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    final hasText = value.trim().isNotEmpty;
    if (hasText != _hasSearchText) setState(() => _hasSearchText = hasText);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) setState(() => _searchQuery = value);
    });
  }

  void _clearSearch() {
    _searchDebounce?.cancel();
    _searchController.clear();
    setState(() {
      _hasSearchText = false;
      _searchQuery = '';
    });
  }

  void _selectTab(_HomeTab tab) {
    if (_selectedTab == tab) return;
    setState(() => _selectedTab = tab);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final screenWidth = MediaQuery.sizeOf(context).width;
    final horizontalPadding = screenWidth < 360 ? 12.0 : 16.0;
    final mockCompanies = ref.watch(marketplaceCompaniesProvider);
    final mockProducts = ref.watch(marketplaceProductsProvider);
    final categoryNames = ref.watch(categoryNamesProvider);
    final categoriesById = ref.watch(categoriesByIdProvider);
    final allCategories =
        ref.watch(allCategoriesProvider).asData?.value ?? const <Category>[];

    // Only active categories that at least one listed product uses become
    // filter chips, so a chip never leads to an empty list.
    final usedCategoryIds = {
      for (final product in mockProducts)
        if (product.categoryId != null) product.categoryId,
    };
    final filterCategories = [
      for (final category in allCategories)
        if (category.isActive && usedCategoryIds.contains(category.id))
          category,
    ];
    final activeFilter =
        filterCategories.any((category) => category.id == _categoryFilter)
            ? _categoryFilter
            : null;

    final filteredCompanies = searchRanked(
      mockCompanies,
      _searchQuery,
      (company) => [
        SearchField(company.name, weight: 3),
        SearchField(company.city ?? ''),
        SearchField(company.address ?? ''),
        SearchField(company.description ?? ''),
      ],
    );

    final filteredProducts = searchRanked(
      mockProducts.where(
        (product) => activeFilter == null || product.categoryId == activeFilter,
      ),
      _searchQuery,
      (product) => [
        SearchField(product.name, weight: 3),
        SearchField(categoriesById[product.categoryId]?.searchText ?? '', weight: 2),
        SearchField(product.companyName ?? ''),
        SearchField(product.description ?? ''),
        SearchField(
          [
            for (final spec in product.specifications.entries)
              '${spec.key} ${spec.value}',
          ].join(' '),
        ),
      ],
    );

    final isProductsTab = _selectedTab == _HomeTab.products;
    final isServicesTab = _selectedTab == _HomeTab.services;

    return ListView(
      controller: _scrollController,
      primary: false,
      padding: EdgeInsets.fromLTRB(
        horizontalPadding,
        16,
        horizontalPadding,
        16,
      ),
      children: [
        TextField(
          controller: _searchController,
          onChanged: _onSearchChanged,
          decoration: InputDecoration(
            hintText: switch (_selectedTab) {
              _HomeTab.products => context.l10n.homeSearchProducts,
              _HomeTab.services => context.l10n.homeSearchServices,
              _HomeTab.companies => context.l10n.homeSearchCompanies,
            },
            hintMaxLines: 1,
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _hasSearchText
                ? IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: _clearSearch,
                  )
                : null,
            filled: true,
            fillColor: colorScheme.surface,
          ),
        ),
        const SizedBox(height: 16),
        if (filterCategories.isNotEmpty) ...[
          CategoryGrid(
            categories: filterCategories,
            selectedId: activeFilter,
            // Picking a category shows its products, whichever tab was open.
            onSelected: (id) => setState(() {
              _categoryFilter = id;
              if (id != null) _selectedTab = _HomeTab.products;
            }),
          ),
          const SizedBox(height: 16),
        ],
        Row(
          children: [
            Expanded(
              child: _HomeTabButton(
                label: context.l10n.navProducts,
                selected: isProductsTab,
                onTap: () => _selectTab(_HomeTab.products),
              ),
            ),
            Expanded(
              child: _HomeTabButton(
                label: context.l10n.navServices,
                selected: isServicesTab,
                onTap: () => _selectTab(_HomeTab.services),
              ),
            ),
            Expanded(
              child: _HomeTabButton(
                label: context.l10n.navCompanies,
                selected: _selectedTab == _HomeTab.companies,
                onTap: () => _selectTab(_HomeTab.companies),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (isProductsTab)
          if (filteredProducts.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Text(
                  context.l10n.homeNoProducts,
                  style: textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ),
            )
          else
            Column(
              children: [
                for (int i = 0; i < filteredProducts.length; i++) ...[
                  ProductCard(
                    product: filteredProducts[i],
                    categoryName: categoryNames[filteredProducts[i].categoryId],
                  ),
                  if (i < filteredProducts.length - 1)
                    const SizedBox(height: 10),
                ],
              ],
            )
        else if (isServicesTab)
          _ServicesList(searchQuery: _searchQuery)
        else if (filteredCompanies.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: Text(
                context.l10n.homeNoCompanies,
                style: textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ),
          )
        else
          Column(
            children: [
              for (int i = 0; i < filteredCompanies.length; i++) ...[
                CompanyCard(company: filteredCompanies[i]),
                if (i < filteredCompanies.length - 1)
                  const SizedBox(height: 10),
              ],
            ],
          ),
      ],
    );
  }
}

/// The Services tab: active catalogue services, filtered by the search box.
/// Watched only while the tab is shown, so the catalogue is not loaded until
/// the customer asks for it.
class _ServicesList extends ConsumerWidget {
  const _ServicesList({required this.searchQuery});

  final String searchQuery;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync = ref.watch(marketplaceServicesProvider);
    final categoryNames = ref.watch(categoryNamesProvider);
    final categoriesById = ref.watch(categoriesByIdProvider);
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    Widget message(String text) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Center(
            child: Text(
              text,
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ),
        );

    return servicesAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => Column(
        children: [
          message(context.l10n.homeServicesLoadFailed),
          OutlinedButton(
            onPressed: () => ref.invalidate(activeServicesProvider(null)),
            child: Text(context.l10n.commonRetry),
          ),
        ],
      ),
      data: (services) {
        final filtered = searchRanked(
          services,
          searchQuery,
          (service) => [
            SearchField(service.name, weight: 3),
            SearchField(categoriesById[service.categoryId]?.searchText ?? '', weight: 2),
            SearchField(service.description),
          ],
        );
        if (filtered.isEmpty) {
          return message(context.l10n.homeNoServices);
        }
        return Column(
          children: [
            for (int i = 0; i < filtered.length; i++) ...[
              ServiceCard(
                service: filtered[i],
                categoryName: categoryNames[filtered[i].categoryId],
              ),
              if (i < filtered.length - 1) const SizedBox(height: 10),
            ],
          ],
        );
      },
    );
  }
}

class _HomeTabButton extends StatelessWidget {
  const _HomeTabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: textTheme.titleSmall?.copyWith(
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected
                    ? colorScheme.primary
                    : colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            height: 3,
            decoration: BoxDecoration(
              color: selected ? colorScheme.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ],
      ),
    );
  }
}