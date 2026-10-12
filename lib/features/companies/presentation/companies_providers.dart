import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../cities/domain/sudan_city.dart';
import '../../cities/presentation/city_providers.dart';
import '../data/datasources/companies_remote_data_source.dart';
import '../data/datasources/firestore_companies_remote_data_source.dart';
import '../data/repositories/companies_repository_impl.dart';
import '../domain/entities/company.dart';
import '../domain/repositories/companies_repository.dart';

final companiesRemoteDataSourceProvider =
    Provider<CompaniesRemoteDataSource>((ref) {
  return FirestoreCompaniesRemoteDataSource();
});

final companiesRepositoryProvider = Provider<CompaniesRepository>((ref) {
  return CompaniesRepositoryImpl(ref.watch(companiesRemoteDataSourceProvider));
});

final firestoreCompaniesStreamProvider = StreamProvider<List<Company>>((ref) {
  return ref.watch(companiesRepositoryProvider).watchAllCompanies();
});

/// Companies customers may see: only active ones. Pending, rejected and
/// deactivated companies stay in Firestore but leave the marketplace.
List<Company> activeCompanies(List<Company> companies) =>
    companies.where((company) => company.isActive).toList();

/// Customer-facing company list: every active Firestore company, the ones
/// that serve the customer's city first. Nothing is hidden because of the
/// city (a customer may be ordering for someone elsewhere); the companies that
/// do not serve it carry a label. Nothing here is made up: no demo companies.
final marketplaceCompaniesProvider = Provider<List<Company>>((ref) {
  final remote = ref.watch(firestoreCompaniesStreamProvider).asData?.value ??
      const <Company>[];
  final cityId = ref.watch(cityFilterProvider);
  return companiesServingCityFirst(activeCompanies(remote), cityId);
});

/// The companies a customer in [cityId] can order from (all of them while the
/// customer has no city).
List<Company> companiesServingCity(List<Company> companies, String? cityId) =>
    companies.where((company) => company.servesCity(cityId)).toList();

/// [companies] with the ones that serve [cityId] first. Each group keeps the
/// order it had. With no city nothing is moved.
List<Company> companiesServingCityFirst(
  List<Company> companies,
  String? cityId,
) {
  if (cityId == null) {
    return companies;
  }
  return [
    ...companies.where((company) => company.servesCity(cityId)),
    ...companies.where((company) => !company.servesCity(cityId)),
  ];
}

/// How many active companies serve each city (a company that listed no cities
/// serves all of them), for the city list.
final cityCompanyCountsProvider = Provider<Map<String, int>>((ref) {
  final remote = ref.watch(firestoreCompaniesStreamProvider).asData?.value;
  if (remote == null) return const {};
  final active = activeCompanies(remote);
  return {
    for (final city in sudanCities)
      city.id: active.where((company) => company.servesCity(city.id)).length,
  };
});

/// The company, when the customer has a city and the company does not serve
/// it; null otherwise (or while the companies have not loaded). It is what
/// puts the "serves: …" label on a company's cards.
final companyOutsideMyCityProvider = Provider.family<Company?, String>((
  ref,
  companyId,
) {
  final cityId = ref.watch(cityFilterProvider);
  if (cityId == null || companyId.isEmpty) {
    return null;
  }
  final companies = ref.watch(firestoreCompaniesStreamProvider).asData?.value;
  if (companies == null) {
    return null;
  }
  for (final company in companies) {
    if (company.id == companyId) {
      return company.servesCity(cityId) ? null : company;
    }
  }
  return null;
});

/// The ids of the companies that serve the customer's city, or null while
/// they have none (nothing is then ranked or labelled).
final servingCompanyIdsProvider = Provider<Set<String>?>((ref) {
  final cityId = ref.watch(cityFilterProvider);
  final companies = ref.watch(firestoreCompaniesStreamProvider).asData?.value;
  if (cityId == null || companies == null) {
    return null;
  }
  return {
    for (final company in companies)
      if (company.servesCity(cityId)) company.id,
  };
});

/// Whether the city the customer is ordering for (their own, or the one they
/// chose for this delivery) is one the company serves. True for a company that
/// cannot be resolved (demo data) or while no city is chosen.
final companyServesMyCityProvider = Provider.family<bool, String>((
  ref,
  companyId,
) {
  final company = ref.watch(resolvedCompanyProvider(companyId));
  return company?.servesCity(ref.watch(deliveryCityIdProvider)) ?? true;
});

final companyStreamProvider =
    StreamProvider.family<Company?, String>((ref, companyId) {
  return ref.watch(companiesRepositoryProvider).watchCompany(companyId);
});

/// Resolves a company from Firestore; null while it loads or when it is gone.
final resolvedCompanyProvider =
    Provider.family<Company?, String>((ref, companyId) {
  return ref.watch(companyStreamProvider(companyId)).asData?.value;
});
