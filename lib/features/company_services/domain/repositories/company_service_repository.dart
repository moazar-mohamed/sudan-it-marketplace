import '../entities/company_service.dart';

abstract class CompanyServiceRepository {
  Future<String> addServiceToCompany({
    required String companyId,
    required String serviceId,
  });

  Future<void> removeServiceFromCompany({
    required String companyId,
    required String serviceId,
  });

  Future<List<CompanyService>> getActiveServicesForCompany(String companyId);

  Future<List<CompanyService>> getCompaniesOfferingService(String serviceId);

  Stream<List<CompanyService>> watchActiveServicesForCompany(String companyId);

  Stream<List<CompanyService>> watchCompaniesOfferingService(String serviceId);
}
