import '../entities/company_service.dart';

abstract class CompanyServiceRepository {
  /// [price] is optional: null (or not positive) stores no price.
  Future<String> addServiceToCompany({
    required String companyId,
    required String serviceId,
    double? price,
    String? note,
  });

  Future<void> updateCompanyServiceDetails({
    required String companyServiceId,
    double? price,
    String? note,
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
