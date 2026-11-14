import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../categories/presentation/category_providers.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../company_services/presentation/company_service_providers.dart';
import '../../products/presentation/products_providers.dart';
import '../../services/presentation/service_providers.dart';
import 'widgets/category_browse.dart';
import 'widgets/home_service_view.dart';

/// The services customers can ask for right now: those a visible company
/// performs. Null until the catalogue and the companies' offers have loaded.
final performedServiceListingsProvider = Provider<List<ServiceListing>?>((ref) {
  final services = ref.watch(marketplaceServicesProvider).asData?.value;
  final links = ref.watch(allActiveCompanyServicesProvider).asData?.value;
  if (services == null || links == null) return null;
  final companies = ref.watch(marketplaceCompaniesProvider);
  return [
    for (final listing in buildServiceListings(
      services: services,
      links: links,
      companies: companies,
    ))
      if (listing.offers.isNotEmpty) listing,
  ];
});

/// How many products and services each category holds for customers, parents
/// counting everything below them. Null until everything has loaded, so an
/// unfinished load never makes categories look empty.
final categoryCountsProvider = Provider<Map<String, CategoryCount>?>((ref) {
  final listings = ref.watch(performedServiceListingsProvider);
  final productsLoaded =
      ref.watch(firestoreProductsStreamProvider).asData != null;
  final companiesLoaded =
      ref.watch(firestoreCompaniesStreamProvider).asData != null;
  if (listings == null || !productsLoaded || !companiesLoaded) return null;
  final products = ref.watch(marketplaceProductsProvider);
  return countByCategory(
    tree: ref.watch(categoryTreeProvider),
    productCategoryIds: [for (final p in products) p.categoryId],
    serviceCategoryIds: [for (final l in listings) l.service.categoryId],
  );
});
