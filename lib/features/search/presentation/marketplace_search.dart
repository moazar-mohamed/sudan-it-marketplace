import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/search_ranking.dart';
import '../../categories/domain/entities/category.dart';
import '../../categories/presentation/category_providers.dart';
import '../../companies/domain/entities/company.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../products/domain/entities/product.dart';
import '../../products/presentation/products_providers.dart';
import '../../services/domain/entities/catalog_service.dart';
import '../../services/presentation/service_providers.dart';

/// What the customer searched: words, or a category picked from the list
/// (then everything in that category and below it).
typedef MarketplaceQuery = ({String text, String? categoryId});

/// Everything in the marketplace that matches one query, best first.
class MarketplaceResults {
  const MarketplaceResults({
    required this.products,
    required this.services,
    required this.companies,
    this.servicesLoading = false,
  });

  final List<Product> products;
  final List<CatalogService> services;
  final List<Company> companies;

  /// The service catalogue is still loading (its results may grow).
  final bool servicesLoading;

  int get total => products.length + services.length + companies.length;
  bool get isEmpty => total == 0;
}

List<SearchField> productSearchFields(
  Product product,
  Map<String, Category> categoriesById,
) =>
    [
      SearchField(product.name, weight: 3),
      SearchField(
        categoriesById[product.categoryId]?.searchText ?? '',
        weight: 2,
      ),
      SearchField(product.brand, weight: 2),
      SearchField(product.companyName ?? ''),
      SearchField(product.description ?? ''),
      SearchField(
        [
          for (final spec in product.specifications.entries)
            '${spec.key} ${spec.value}',
        ].join(' '),
      ),
    ];

List<SearchField> serviceSearchFields(
  CatalogService service,
  Map<String, Category> categoriesById,
) =>
    [
      SearchField(service.name, weight: 3),
      SearchField(
        categoriesById[service.categoryId]?.searchText ?? '',
        weight: 2,
      ),
      SearchField(service.description),
    ];

List<SearchField> companySearchFields(Company company) => [
      SearchField(company.name, weight: 3),
      SearchField(company.city ?? ''),
      SearchField(company.address ?? ''),
      SearchField(company.description ?? ''),
    ];

/// The names people can search for: what a "did you mean" is built from.
final marketplaceVocabularyProvider = Provider<List<String>>((ref) {
  final products = ref.watch(marketplaceProductsProvider);
  final companies = ref.watch(marketplaceCompaniesProvider);
  final services =
      ref.watch(marketplaceServicesProvider).asData?.value ?? const [];
  final categoriesById = ref.watch(categoriesByIdProvider);
  return [
    for (final product in products) ...[product.name, product.brand],
    for (final service in services) service.name,
    for (final company in companies) company.name,
    for (final category in categoriesById.values) category.searchText,
  ];
});

/// How the product results are ordered.
enum ProductSort { relevance, priceLow, priceHigh }

/// [products] ordered and filtered the way the customer chose. Relevance keeps
/// the ranking; a price order puts products without a price last.
List<Product> arrangeProducts(
  List<Product> products, {
  required ProductSort sort,
  required bool inStockOnly,
}) {
  final shown = [
    for (final product in products)
      if (!inStockOnly || product.isAvailable) product,
  ];
  if (sort == ProductSort.relevance) return shown;
  double? priceOf(Product p) => p.offerPrice ?? p.price;
  shown.sort((a, b) {
    final pa = priceOf(a);
    final pb = priceOf(b);
    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;
    return sort == ProductSort.priceLow ? pa.compareTo(pb) : pb.compareTo(pa);
  });
  return shown;
}

final marketplaceSearchProvider =
    Provider.family<MarketplaceResults, MarketplaceQuery>((ref, query) {
  final products = ref.watch(marketplaceProductsProvider);
  final companies = ref.watch(marketplaceCompaniesProvider);
  final servicesAsync = ref.watch(marketplaceServicesProvider);
  final services = servicesAsync.asData?.value ?? const <CatalogService>[];
  final categoriesById = ref.watch(categoriesByIdProvider);

  final categoryId = query.categoryId;
  if (categoryId != null) {
    final scope = ref.watch(categoryTreeProvider).subtreeIds(categoryId);
    final inScope = [
      for (final product in products)
        if (scope.contains(product.categoryId)) product,
    ];
    // Companies that sell something in the category.
    final sellers = {for (final product in inScope) product.companyId};
    return MarketplaceResults(
      products: inScope,
      services: [
        for (final service in services)
          if (scope.contains(service.categoryId)) service,
      ],
      companies: [
        for (final company in companies)
          if (sellers.contains(company.id)) company,
      ],
      servicesLoading: servicesAsync.isLoading,
    );
  }

  if (query.text.trim().isEmpty) {
    return const MarketplaceResults(products: [], services: [], companies: []);
  }
  return MarketplaceResults(
    products: searchRanked(
      products,
      query.text,
      (product) => productSearchFields(product, categoriesById),
      // Among equally good matches, what can be bought now comes first.
      tieBreak: (product) => product.isAvailable ? 1 : 0,
    ),
    services: searchRanked(
      services,
      query.text,
      (service) => serviceSearchFields(service, categoriesById),
    ),
    companies: searchRanked(companies, query.text, companySearchFields),
    servicesLoading: servicesAsync.isLoading,
  );
});
