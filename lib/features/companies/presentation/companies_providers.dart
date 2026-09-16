import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../customer_dashboard/data/mock_marketplace_data.dart';
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

/// Customer-facing company list: Firestore companies plus the demo companies
/// whose ids are not already present in Firestore.
final marketplaceCompaniesProvider = Provider<List<Company>>((ref) {
  final remote = ref.watch(firestoreCompaniesStreamProvider).asData?.value ??
      const <Company>[];
  final remoteIds = remote.map((company) => company.id).toSet();
  return [
    ...remote,
    ...mockCompanies.where((company) => !remoteIds.contains(company.id)),
  ];
});

final companyStreamProvider =
    StreamProvider.family<Company?, String>((ref, companyId) {
  return ref.watch(companiesRepositoryProvider).watchCompany(companyId);
});

/// Resolves a company from Firestore first, then the demo data.
final resolvedCompanyProvider =
    Provider.family<Company?, String>((ref, companyId) {
  final remote = ref.watch(companyStreamProvider(companyId)).asData?.value;
  if (remote != null) {
    return remote;
  }
  for (final company in mockCompanies) {
    if (company.id == companyId) {
      return company;
    }
  }
  return null;
});
