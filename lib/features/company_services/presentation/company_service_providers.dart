import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../companies/domain/entities/company.dart';
import '../../companies/presentation/companies_providers.dart';
import '../data/datasources/company_service_remote_data_source.dart';
import '../data/datasources/firestore_company_service_remote_data_source.dart';
import '../data/repositories/company_service_repository_impl.dart';
import '../domain/entities/company_service.dart';
import '../domain/repositories/company_service_repository.dart';

final companyServiceRemoteDataSourceProvider =
    Provider<CompanyServiceRemoteDataSource>((ref) {
      return FirestoreCompanyServiceRemoteDataSource();
    });

final companyServiceRepositoryProvider = Provider<CompanyServiceRepository>((
  ref,
) {
  return CompanyServiceRepositoryImpl(
    ref.watch(companyServiceRemoteDataSourceProvider),
  );
});

final activeServicesForCompanyProvider =
    StreamProvider.family<List<CompanyService>, String>((ref, companyId) {
      return ref
          .watch(companyServiceRepositoryProvider)
          .watchActiveServicesForCompany(companyId);
    });

final companiesOfferingServiceProvider =
    StreamProvider.family<List<CompanyService>, String>((ref, serviceId) {
      return ref
          .watch(companyServiceRepositoryProvider)
          .watchCompaniesOfferingService(serviceId);
    });

/// One company's offer of a catalogue service, as shown to customers.
class ServiceOffer {
  const ServiceOffer({required this.offer, required this.company});

  final CompanyService offer;
  final Company company;
}

/// The companies customers can request [serviceId] from: active offers of
/// companies that exist in Firestore and are active. Deactivated, pending
/// and rejected companies never appear.
final serviceOffersProvider =
    Provider.family<AsyncValue<List<ServiceOffer>>, String>((ref, serviceId) {
  final links = ref.watch(companiesOfferingServiceProvider(serviceId));
  final companies = ref.watch(firestoreCompaniesStreamProvider);
  if (links.hasError) {
    return AsyncValue.error(links.error!, links.stackTrace!);
  }
  if (companies.hasError) {
    return AsyncValue.error(companies.error!, companies.stackTrace!);
  }
  final linkList = links.asData?.value;
  final companyList = companies.asData?.value;
  if (linkList == null || companyList == null) {
    return const AsyncValue.loading();
  }
  final companiesById = {
    for (final company in activeCompanies(companyList)) company.id: company,
  };
  final offers = [
    for (final link in linkList)
      if (companiesById[link.companyId] case final company?)
        ServiceOffer(offer: link, company: company),
  ]..sort((a, b) => a.company.name.compareTo(b.company.name));
  return AsyncValue.data(offers);
});
