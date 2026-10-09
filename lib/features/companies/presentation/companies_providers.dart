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

/// Customer-facing company list: the active Firestore companies that serve
/// the customer's city. Nothing here is made up: no demo companies.
final marketplaceCompaniesProvider = Provider<List<Company>>((ref) {
  final remote = ref.watch(firestoreCompaniesStreamProvider).asData?.value ??
      const <Company>[];
  final cityId = ref.watch(cityFilterProvider);
  return companiesServingCity(activeCompanies(remote), cityId);
});

/// The companies a customer in [cityId] can order from (all of them while the
/// customer has no city).
List<Company> companiesServingCity(List<Company> companies, String? cityId) =>
    companies.where((company) => company.servesCity(cityId)).toList();

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

/// Whether the signed-in customer's city is one the company serves. True for
/// a company that cannot be resolved (demo data) or while no city is chosen.
final companyServesMyCityProvider = Provider.family<bool, String>((
  ref,
  companyId,
) {
  final company = ref.watch(resolvedCompanyProvider(companyId));
  return company?.servesCity(ref.watch(customerCityIdProvider)) ?? true;
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
