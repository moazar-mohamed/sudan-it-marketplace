import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/utils/search_ranking.dart';
import '../../../../core/widgets/app_widgets.dart';
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
    final screenWidth = MediaQuery.sizeOf(context).width;
    final horizontalPadding = AppSpacing.screenMargin(screenWidth);
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
        AppSearchField(
          controller: _searchController,
          onChanged: _onSearchChanged,
          onCleared: _clearSearch,
          hint: switch (_selectedTab) {
            _HomeTab.products => context.l10n.homeSearchProducts,
            _HomeTab.services => context.l10n.homeSearchServices,
            _HomeTab.companies => context.l10n.homeSearchCompanies,
          },
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
        AppUnderlineTabs(
          labels: [
            context.l10n.navProducts,
            context.l10n.navServices,
            context.l10n.navCompanies,
          ],
          selectedIndex: _selectedTab.index,
          onChanged: (index) => _selectTab(_HomeTab.values[index]),
        ),
        const SizedBox(height: 16),
        if (isProductsTab)
          if (filteredProducts.isEmpty)
            AppEmptyState(
              icon: Icons.search_off_rounded,
              message: context.l10n.homeNoProducts,
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
          AppEmptyState(
            icon: Icons.search_off_rounded,
            message: context.l10n.homeNoCompanies,
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

    return servicesAsync.when(
      loading: () => const AppSkeletonList(count: 2),
      error: (_, _) => AppErrorState(
        message: context.l10n.homeServicesLoadFailed,
        onRetry: () => ref.invalidate(activeServicesProvider(null)),
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
          return AppEmptyState(
            icon: Icons.search_off_rounded,
            message: context.l10n.homeNoServices,
          );
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
