import 'package:flutter_riverpod/flutter_riverpod.dart';

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
