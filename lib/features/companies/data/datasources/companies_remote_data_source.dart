import '../../domain/entities/company.dart';
import '../../domain/entities/payment_account.dart';

abstract interface class CompaniesRemoteDataSource {
  Stream<List<Company>> watchAllCompanies();

  Stream<Company?> watchCompany(String companyId);

  Future<void> updateCompanyProfile(Company company);

  Future<void> updatePaymentAccounts(
    String companyId,
    List<PaymentAccount> accounts,
  );

  /// The company's bank accounts (`company_payment/{companyId}`): signed-in
  /// customers, the company's admin and Platform Admin read them; empty when
  /// there are none or they cannot be read.
  Stream<List<PaymentAccount>> watchPaymentAccounts(String companyId);

  /// The company's email (`company_private/{companyId}`): only its own admin
  /// and Platform Admin read it. Null when it cannot be read.
  Stream<String?> watchCompanyEmail(String companyId);

  /// Sets the company's dollar rate (or confirms it unchanged) and writes the
  /// pounds of its dollar-priced products worked out from it ([repricing]:
  /// product id to the fields to set). The rate goes with the first products
  /// in one batch, so they never disagree; a long catalogue takes more.
  Future<void> setUsdRate(
    String companyId,
    double rate,
    Map<String, Map<String, Object?>> repricing,
  );

  /// Writes [repricing] alone: products a cut-short rewrite missed.
  Future<void> repriceProducts(Map<String, Map<String, Object?>> repricing);
}
