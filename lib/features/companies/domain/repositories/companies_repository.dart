import '../entities/company.dart';
import '../entities/payment_account.dart';

abstract interface class CompaniesRepository {
  /// Every ACTIVE company (pending, rejected and deactivated ones are not
  /// readable by customers).
  Stream<List<Company>> watchAllCompanies();

  Stream<Company?> watchCompany(String companyId);

  Future<void> updateCompanyProfile(Company company);

  Future<void> updatePaymentAccounts(
    String companyId,
    List<PaymentAccount> accounts,
  );

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
