import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/utils/search_ranking.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../companies/presentation/widgets/company_card.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/widgets/product_card.dart';
import '../../../services/presentation/service_providers.dart';
import '../../../services/presentation/widgets/service_card.dart';
import 'category_browser.dart';
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

  /// The category being browsed in each tree (its whole subtree is the
  /// filter); null = every product or service.
  String? _productCategory;
  String? _serviceCategory;
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
    final productTree = ref.watch(categoryTreeProvider);

    final productCategory = CategoryBrowser.validCurrent(
      productTree,
      _productCategory,
    );
    final productScope = productCategory == null
        ? null
        : productTree.subtreeIds(productCategory);

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
        (product) =>
            productScope == null || productScope.contains(product.categoryId),
      ),
      _searchQuery,
      (product) => [
        SearchField(product.name, weight: 3),
        SearchField(
          categoriesById[product.categoryId]?.searchText ?? '',
          weight: 2,
        ),
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
        // Products and services browse the same category tree; companies has none.
        if (isProductsTab) ...[
          CategoryBrowser(
            tree: productTree,
            currentId: productCategory,
            onChanged: (id) => setState(() => _productCategory = id),
          ),
          if (productTree.activeChildrenOf(productCategory).isNotEmpty ||
              productCategory != null)
            const SizedBox(height: 16),
        ],
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
          _ServicesList(
            searchQuery: _searchQuery,
            categoryId: _serviceCategory,
            onCategoryChanged: (id) => setState(() => _serviceCategory = id),
          )
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
  const _ServicesList({
    required this.searchQuery,
    required this.categoryId,
    required this.onCategoryChanged,
  });

  final String searchQuery;

  /// The service category being browsed (its subtree is the filter).
  final String? categoryId;
  final ValueChanged<String?> onCategoryChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync = ref.watch(marketplaceServicesProvider);
    final categoryNames = ref.watch(categoryNamesProvider);
    final categoriesById = ref.watch(categoriesByIdProvider);
    final serviceTree = ref.watch(categoryTreeProvider);

    return servicesAsync.when(
      loading: () => const AppSkeletonList(count: 2),
      error: (_, _) => AppErrorState(
        message: context.l10n.homeServicesLoadFailed,
        onRetry: () => ref.invalidate(activeServicesProvider(null)),
      ),
      data: (services) {
        final current = CategoryBrowser.validCurrent(serviceTree, categoryId);
        final scope = current == null ? null : serviceTree.subtreeIds(current);
        final filtered = searchRanked(
          services.where(
            (service) => scope == null || scope.contains(service.categoryId),
          ),
          searchQuery,
          (service) => [
            SearchField(service.name, weight: 3),
            SearchField(
              categoriesById[service.categoryId]?.searchText ?? '',
              weight: 2,
            ),
            SearchField(service.description),
          ],
        );
        final browser = CategoryBrowser(
          tree: serviceTree,
          currentId: current,
          onChanged: onCategoryChanged,
        );
        if (filtered.isEmpty) {
          return Column(
            children: [
              browser,
              AppEmptyState(
                icon: Icons.search_off_rounded,
                message: context.l10n.homeNoServices,
              ),
            ],
          );
        }
        return Column(
          children: [
            browser,
            if (serviceTree.activeChildrenOf(current).isNotEmpty ||
                current != null)
              const SizedBox(height: 16),
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
