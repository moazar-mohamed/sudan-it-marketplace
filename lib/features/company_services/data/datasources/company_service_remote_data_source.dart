import '../models/company_service_model.dart';

abstract class CompanyServiceRemoteDataSource {
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

  Future<List<CompanyServiceModel>> getActiveServicesForCompany(
    String companyId,
  );

  Future<List<CompanyServiceModel>> getCompaniesOfferingService(
    String serviceId,
  );

  Stream<List<CompanyServiceModel>> watchActiveServicesForCompany(
    String companyId,
  );

  Stream<List<CompanyServiceModel>> watchCompaniesOfferingService(
    String serviceId,
  );
}
