import '../../domain/entities/company.dart';
import '../../domain/entities/payment_account.dart';
import '../../domain/repositories/companies_repository.dart';
import '../datasources/companies_remote_data_source.dart';

class CompaniesRepositoryImpl implements CompaniesRepository {
  const CompaniesRepositoryImpl(this._remoteDataSource);

  final CompaniesRemoteDataSource _remoteDataSource;

  @override
  Stream<List<Company>> watchAllCompanies() =>
      _remoteDataSource.watchAllCompanies();

  @override
  Stream<Company?> watchCompany(String companyId) =>
      _remoteDataSource.watchCompany(companyId);

  @override
  Future<void> updateCompanyProfile(Company company) =>
      _remoteDataSource.updateCompanyProfile(company);

  @override
  Future<void> updatePaymentAccounts(
    String companyId,
    List<PaymentAccount> accounts,
  ) =>
      _remoteDataSource.updatePaymentAccounts(companyId, accounts);

  @override
  Future<void> setUsdRate(
    String companyId,
    double rate,
    Map<String, Map<String, Object?>> repricing,
  ) =>
      _remoteDataSource.setUsdRate(companyId, rate, repricing);

  @override
  Future<void> repriceProducts(Map<String, Map<String, Object?>> repricing) =>
      _remoteDataSource.repriceProducts(repricing);
}
