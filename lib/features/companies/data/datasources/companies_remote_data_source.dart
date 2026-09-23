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
}
