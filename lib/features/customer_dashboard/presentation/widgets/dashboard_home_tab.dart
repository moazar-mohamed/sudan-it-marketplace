import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/presentation/category_providers.dart';
import '../category_counts_provider.dart';
import '../category_screen.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../services/presentation/service_providers.dart';
import '../../../company_services/domain/entities/company_service.dart';
import '../../../services/domain/entities/catalog_service.dart';
import '../../../company_services/presentation/company_service_providers.dart';
import 'category_browse.dart';
import 'category_browser.dart';
import 'category_grid_style.dart';
import 'home_header.dart';
import 'home_companies_row.dart';
import 'home_companies_tab.dart';
import 'home_company_view.dart';
import 'home_hero_offers.dart';
import 'home_product_view.dart';
import 'home_products_section.dart';
import 'home_recent_row.dart';
import 'home_service_card.dart';
import 'home_service_view.dart';
import 'home_services_intro.dart';
import 'home_trust_strip.dart';
import 'featured_offers_strip.dart';
import '../../../offers/domain/offer_item.dart';
import '../../../offers/presentation/offers_providers.dart';
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

  _HomeTab _selectedTab = _HomeTab.products;

  /// How the products list is ordered and narrowed (the chips above it).
  ProductSort _sort = ProductSort.newest;
  ProductFilters _filters = const ProductFilters();

  /// Where "All products" starts, so "Recently added -> View all" can scroll to it.
  final GlobalKey _allProductsKey = GlobalKey();

  /// The Companies tab: the category chip chosen (a top-level category) and
  /// how the companies are ordered.
  String? _companyCategory;
  CompanySort _companySort = CompanySort.topRated;

  /// Where the services list starts, for the banner's button.
  final GlobalKey _servicesListKey = GlobalKey();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  /// Orders the list newest first with no filter, and scrolls down to it.
  void _showAllProducts() {
    setState(() {
      _sort = ProductSort.newest;
      _filters = const ProductFilters();
    });
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _scrollTo(_allProductsKey),
    );
  }

  void _scrollTo(GlobalKey key) {
    final target = key.currentContext;
    if (target != null) {
      Scrollable.ensureVisible(
        target,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  /// A category opens on its own screen, with its sub-categories, filters and
  /// everything in it.
  void _openCategory(String id) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => CategoryScreen(categoryId: id)),
    );
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

    final counts = ref.watch(categoryCountsProvider);

    final filteredCompanies = mockCompanies;
    final filteredProducts = mockProducts;

    // Products and services on offer.
    final serviceOffers = ref.watch(marketplaceServiceOffersProvider);
    final offers = runningOffers([
      for (final product in filteredProducts) ProductOfferItem(product),
      ...serviceOffers,
    ]);

    final isProductsTab = _selectedTab == _HomeTab.products;
    final isServicesTab = _selectedTab == _HomeTab.services;

    final categoriesById = ref.watch(categoriesByIdProvider);
    final recent = recentProducts(filteredProducts, DateTime.now());

    // Each section sets its own side space, so a sideways row or a full-width
    // band can reach the screen edge.
    Widget padded(Widget child) => Padding(
      padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
      child: child,
    );
    const gap = SizedBox(height: 20);

    return ListView(
      controller: _scrollController,
      primary: false,
      padding: EdgeInsets.zero,
      children: [
        HomeHeaderBlock(
          tabLabels: [
            context.l10n.navProducts,
            context.l10n.navServices,
            context.l10n.navCompanies,
          ],
          selectedIndex: _selectedTab.index,
          onTabChanged: (index) => _selectTab(_HomeTab.values[index]),
        ),
        const SizedBox(height: 16),
        // Products and services browse the same category tree; companies has none.
        if (isProductsTab) ...[
          if (offers.isNotEmpty) ...[
            HomeHeroOffers(offers: offers, categories: categoriesById),
            gap,
          ],
          CategoryBrowser(
            tree: productTree,
            counts: counts,
            title: context.l10n.homeShopByCategory,
            style: CategoryGridStyle.homeRow,
            horizontalPadding: horizontalPadding,
            onOpen: _openCategory,
          ),
          gap,
          padded(const HomeTrustStrip()),
          gap,
          // Under the categories: the offers of the category being browsed.
          if (offers.isNotEmpty) ...[
            FeaturedOffersStrip(
              offers: offers,
              categories: categoriesById,
              horizontalPadding: horizontalPadding,
            ),
            gap,
          ],
          // The verified companies and what was added lately.
          HomeVerifiedCompaniesRow(
            companies: filteredCompanies,
            horizontalPadding: horizontalPadding,
            onViewAll: () => _selectTab(_HomeTab.companies),
          ),
          gap,
          if (recent.isNotEmpty) ...[
            HomeRecentRow(
              products: recent,
              categories: categoriesById,
              horizontalPadding: horizontalPadding,
              onViewAll: _showAllProducts,
            ),
            gap,
          ],
          HomeProductsSection(
            headerKey: _allProductsKey,
            products: filteredProducts,
            categories: categoriesById,
            categoryNames: categoryNames,
            sort: _sort,
            filters: _filters,
            onSortChanged: (sort) => setState(() => _sort = sort),
            onFiltersChanged: (filters) => setState(() => _filters = filters),
            horizontalPadding: horizontalPadding,
          ),
        ] else if (isServicesTab)
          _ServicesList(
            counts: counts,
            onCategorySelected: _openCategory,
            horizontalPadding: horizontalPadding,
            listKey: _servicesListKey,
            onRequest: () => _scrollTo(_servicesListKey),
          )
        else
          HomeCompaniesTab(
            companies: filteredCompanies,
            topCategories: companyTopCategories(
              tree: productTree,
              products: mockProducts,
              links:
                  ref.watch(allActiveCompanyServicesProvider).asData?.value ??
                  const <CompanyService>[],
              services:
                  ref.watch(marketplaceServicesProvider).asData?.value ??
                  const <CatalogService>[],
            ),
            categoriesById: categoriesById,
            categoryId: _companyCategory,
            sort: _companySort,
            onCategoryChanged: (id) => setState(() => _companyCategory = id),
            onSortChanged: (sort) => setState(() => _companySort = sort),
            horizontalPadding: horizontalPadding,
          ),
        const SizedBox(height: 16),
      ],
    );
  }
}

/// The Services tab: the banner and steps, the category row, then the active
/// catalogue services of the browsed category with what companies ask for
/// them. Watched only while the tab is shown, so the catalogue is not loaded
/// until the customer asks for it.
class _ServicesList extends ConsumerWidget {
  const _ServicesList({
    required this.counts,
    required this.onCategorySelected,
    required this.horizontalPadding,
    required this.listKey,
    required this.onRequest,
  });

  /// What each category holds, and what opening one does.
  final Map<String, CategoryCount>? counts;
  final ValueChanged<String> onCategorySelected;
  final double horizontalPadding;

  /// Marks where the list of services starts.
  final GlobalKey listKey;

  /// The banner's button: go down to the services.
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync = ref.watch(marketplaceServicesProvider);
    final categoryNames = ref.watch(categoryNamesProvider);
    final categoriesById = ref.watch(categoriesByIdProvider);
    final serviceTree = ref.watch(categoryTreeProvider);
    final links =
        ref.watch(allActiveCompanyServicesProvider).asData?.value ??
        const <CompanyService>[];
    final companies = ref.watch(marketplaceCompaniesProvider);

    Widget padded(Widget child) => Padding(
      padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
      child: child,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        padded(HomeServiceBanner(onRequest: onRequest)),
        const SizedBox(height: 12),
        padded(const HomeServiceSteps()),
        const SizedBox(height: 20),
        CategoryBrowser(
          tree: serviceTree,
          counts: counts,
          title: context.l10n.homeServicesByCategory,
          style: CategoryGridStyle.homeRow,
          horizontalPadding: horizontalPadding,
          onOpen: onCategorySelected,
        ),
        const SizedBox(height: 20),
        servicesAsync.when(
          loading: () => padded(const AppSkeletonList(count: 2)),
          error: (_, _) => padded(
            AppErrorState(
              message: context.l10n.homeServicesLoadFailed,
              onRetry: () => ref.invalidate(activeServicesProvider(null)),
            ),
          ),
          data: (services) {
            final listings = buildServiceListings(
              services: services,
              links: links,
              companies: companies,
            );
            if (listings.isEmpty) {
              return padded(
                AppEmptyState(
                  icon: Icons.search_off_rounded,
                  message: context.l10n.homeNoServices,
                ),
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  key: listKey,
                  padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
                  child: Text(
                    context.l10n.homeMostRequested,
                    style: AppTextStyles.h2,
                  ),
                ),
                const SizedBox(height: 12),
                padded(
                  Column(
                    children: [
                      for (var i = 0; i < listings.length; i++) ...[
                        HomeServiceCard(
                          listing: listings[i],
                          category:
                              categoriesById[listings[i].service.categoryId],
                          categoryName:
                              categoryNames[listings[i].service.categoryId],
                        ),
                        if (i < listings.length - 1) const SizedBox(height: 12),
                      ],
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}
