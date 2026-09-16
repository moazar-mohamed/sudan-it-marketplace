import '../../domain/entities/company.dart';

abstract interface class CompaniesRemoteDataSource {
  Stream<List<Company>> watchAllCompanies();

  Stream<Company?> watchCompany(String companyId);

  Future<void> updateCompanyProfile(Company company);
}
