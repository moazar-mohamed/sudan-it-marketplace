import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../cities/presentation/city_providers.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../company_services/presentation/company_service_providers.dart';
import '../../products/presentation/products_providers.dart';
import '../../services/domain/entities/catalog_service.dart';
import '../../services/presentation/service_providers.dart';
import '../domain/offer_item.dart';

/// Services on offer that customers can request: a running offer, on a
/// service still in the marketplace, from an active company.
final marketplaceServiceOffersProvider = Provider<List<ServiceOfferItem>>((
  ref,
) {
  final links =
      ref.watch(allActiveCompanyServicesProvider).asData?.value ?? const [];
  final services =
      ref.watch(marketplaceServicesProvider).asData?.value ?? const [];
  final companies = ref.watch(firestoreCompaniesStreamProvider).asData?.value;
  if (companies == null) return const [];
  final servicesById = {for (final service in services) service.id: service};
  final companyNames = {
    for (final company in companiesServingCity(
      activeCompanies(companies),
      ref.watch(cityFilterProvider),
    ))
      company.id: company.name,
  };
  return [
    for (final link in links)
      if (link.hasActiveOffer)
        if (servicesById[link.serviceId] case final service?)
          if (companyNames[link.companyId] case final companyName?)
            ServiceOfferItem(
              link: link,
              service: service,
              companyName: companyName,
            ),
  ];
});

/// Everything one company has put on offer, running or ended, products
/// first. Ended offers stay listed until the company removes them.
final companyOffersProvider =
    Provider.family<AsyncValue<List<OfferItem>>, String>((ref, companyId) {
  final products = ref.watch(companyProductsStreamProvider(companyId));
  final links = ref.watch(activeServicesForCompanyProvider(companyId));
  if (products.hasError) {
    return AsyncValue.error(products.error!, products.stackTrace!);
  }
  if (links.hasError) return AsyncValue.error(links.error!, links.stackTrace!);
  final productList = products.asData?.value;
  final linkList = links.asData?.value;
  if (productList == null || linkList == null) {
    return const AsyncValue.loading();
  }
  final services = ref.watch(allServicesProvider(null)).asData?.value ??
      const <CatalogService>[];
  final servicesById = {for (final service in services) service.id: service};
  final companyName =
      ref.watch(companyStreamProvider(companyId)).asData?.value?.name ?? '';
  return AsyncValue.data([
    for (final product in productList)
      if (product.hasOffer) ProductOfferItem(product),
    for (final link in linkList)
      if (link.hasOffer)
        if (servicesById[link.serviceId] case final service?)
          ServiceOfferItem(
            link: link,
            service: service,
            companyName: companyName,
          ),
  ]);
});
