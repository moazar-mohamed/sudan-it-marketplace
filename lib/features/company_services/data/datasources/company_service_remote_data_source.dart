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

  /// Sets the offer on one company service; a `null` [offerPrice] ends it.
  Future<void> setCompanyServiceOffer({
    required String companyServiceId,
    double? offerPrice,
    DateTime? offerEndsAt,
    String? offerBadge,
  });

  /// Every active company service of every company (offers are picked from
  /// these for the customer home).
  Stream<List<CompanyServiceModel>> watchAllActiveServices();

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
