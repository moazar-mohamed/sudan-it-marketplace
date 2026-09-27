import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../companies/presentation/widgets/company_card.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/widgets/product_card.dart';
import '../../../services/presentation/service_providers.dart';
import '../../../search/presentation/customer_search_screen.dart';
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
  // Owned by this tab so it never binds to the ambient PrimaryScrollController,
  // which the sibling IndexedStack tabs also attach to.
  final ScrollController _scrollController = ScrollController();

  /// The category being browsed in each tree (its whole subtree is the
  /// filter); null = every product or service.
  String? _productCategory;
  String? _serviceCategory;
  _HomeTab _selectedTab = _HomeTab.products;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
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
    final productTree = ref.watch(categoryTreeProvider);

    final productCategory = CategoryBrowser.validCurrent(
      productTree,
      _productCategory,
    );
    final productScope = productCategory == null
        ? null
        : productTree.subtreeIds(productCategory);

    final filteredCompanies = mockCompanies;
    final filteredProducts = [
      for (final product in mockProducts)
        if (productScope == null || productScope.contains(product.categoryId))
          product,
    ];

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
        const _SearchLauncher(),
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

/// The Services tab: active catalogue services of the browsed category.
/// Watched only while the tab is shown, so the catalogue is not loaded until
/// the customer asks for it.
class _ServicesList extends ConsumerWidget {
  const _ServicesList({
    required this.categoryId,
    required this.onCategoryChanged,
  });

  /// The service category being browsed (its subtree is the filter).
  final String? categoryId;
  final ValueChanged<String?> onCategoryChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync = ref.watch(marketplaceServicesProvider);
    final categoryNames = ref.watch(categoryNamesProvider);
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
        final filtered = [
          for (final service in services)
            if (scope == null || scope.contains(service.categoryId)) service,
        ];
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

/// Looks like a search box; opens the full search, which covers products,
/// services and companies at once.
class _SearchLauncher extends StatelessWidget {
  const _SearchLauncher();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      label: context.l10n.searchHint,
      excludeSemantics: true,
      child: Material(
        key: const ValueKey('home-search-launcher'),
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.smAll,
          side: BorderSide(color: colors.borderInput),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const CustomerSearchScreen(),
            ),
          ),
          child: SizedBox(
            height: AppSize.controlLg,
            child: Row(
              children: [
                const SizedBox(width: AppSpacing.s12),
                Icon(Icons.search_rounded, color: colors.iconMuted),
                const SizedBox(width: AppSpacing.s8),
                Expanded(
                  child: Text(
                    context.l10n.searchHint,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.body.copyWith(
                      color: colors.textTertiary,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.s12),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
