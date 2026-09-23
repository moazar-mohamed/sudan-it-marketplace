import '../entities/company.dart';
import '../entities/payment_account.dart';

abstract interface class CompaniesRepository {
  Stream<List<Company>> watchAllCompanies();

  Stream<Company?> watchCompany(String companyId);

  Future<void> updateCompanyProfile(Company company);

  Future<void> updatePaymentAccounts(
    String companyId,
    List<PaymentAccount> accounts,
  );
}
