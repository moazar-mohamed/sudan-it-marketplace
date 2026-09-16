import '../entities/company.dart';

abstract interface class CompaniesRepository {
  Stream<List<Company>> watchAllCompanies();

  Stream<Company?> watchCompany(String companyId);

  Future<void> updateCompanyProfile(Company company);
}
