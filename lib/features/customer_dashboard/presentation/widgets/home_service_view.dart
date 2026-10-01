import '../../../companies/domain/entities/company.dart';
import '../../../company_services/domain/entities/company_service.dart';
import '../../../services/domain/entities/catalog_service.dart';

/// A catalogue service together with what customers can get it for: the
/// active offers of the companies that perform it.
class ServiceListing {
  const ServiceListing({
    required this.service,
    required this.offers,
    required this.companies,
  });

  final CatalogService service;

  /// The companies' active offers of this service, cheapest first (those
  /// without a price last).
  final List<CompanyService> offers;

  /// The company behind each of [offers], by company id.
  final Map<String, Company> companies;

  /// The offer a customer would most likely start from: the cheapest.
  CompanyService? get lead => offers.isEmpty ? null : offers.first;

  /// The company of [lead].
  Company? get leadCompany => lead == null ? null : companies[lead!.companyId];

  /// How many other companies perform it too.
  int get otherCompanies => offers.isEmpty ? 0 : offers.length - 1;

  /// What the cheapest company asks, or null when none has set a price.
  double? get startsFrom => lead?.salePrice;

  /// The best running discount among the offers, or 0.
  int get bestDiscount => offers.fold(
    0,
    (best, o) => o.hasActiveOffer && o.offerDiscountPercent > best
        ? o.offerDiscountPercent
        : best,
  );
}

/// Each of [services] with the active offers of the companies in
/// [companies] (the ones customers can see), most performed first. Services
/// nobody performs yet stay listed, after the others.
List<ServiceListing> buildServiceListings({
  required List<CatalogService> services,
  required List<CompanyService> links,
  required List<Company> companies,
}) {
  final companiesById = {for (final c in companies) c.id: c};
  final listings = <(int, ServiceListing)>[];
  for (var i = 0; i < services.length; i++) {
    final service = services[i];
    final offers = [
      for (final link in links)
        if (link.isActive &&
            link.serviceId == service.id &&
            companiesById.containsKey(link.companyId))
          link,
    ];
    // Cheapest first; an offer without a price goes last.
    offers.sort((a, b) {
      final pa = a.salePrice;
      final pb = b.salePrice;
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa.compareTo(pb);
    });
    listings.add((
      i,
      ServiceListing(
        service: service,
        offers: offers,
        companies: {
          for (final o in offers) o.companyId: companiesById[o.companyId]!,
        },
      ),
    ));
  }
  listings.sort((a, b) {
    final byCount = b.$2.offers.length.compareTo(a.$2.offers.length);
    return byCount != 0 ? byCount : a.$1.compareTo(b.$1);
  });
  return [for (final entry in listings) entry.$2];
}
