import '../../domain/entities/company_service.dart';
import '../../domain/exceptions/company_service_exception.dart';
import '../../domain/repositories/company_service_repository.dart';
import '../datasources/company_service_remote_data_source.dart';

class CompanyServiceRepositoryImpl implements CompanyServiceRepository {
  CompanyServiceRepositoryImpl(this._remoteDataSource);

  final CompanyServiceRemoteDataSource _remoteDataSource;

  @override
  Future<String> addServiceToCompany({
    required String companyId,
    required String serviceId,
    double? price,
    String? note,
  }) {
    return _run(
      () => _remoteDataSource.addServiceToCompany(
        companyId: companyId,
        serviceId: serviceId,
        price: price,
        note: note,
      ),
    );
  }

  @override
  Future<void> updateCompanyServiceDetails({
    required String companyServiceId,
    double? price,
    String? note,
  }) {
    return _run(
      () => _remoteDataSource.updateCompanyServiceDetails(
        companyServiceId: companyServiceId,
        price: price,
        note: note,
      ),
    );
  }

  @override
  Future<void> removeServiceFromCompany({
    required String companyId,
    required String serviceId,
  }) {
    return _run(
      () => _remoteDataSource.removeServiceFromCompany(
        companyId: companyId,
        serviceId: serviceId,
      ),
    );
  }

  @override
  Future<List<CompanyService>> getActiveServicesForCompany(String companyId) {
    return _run(
      () => _remoteDataSource.getActiveServicesForCompany(companyId),
    );
  }

  @override
  Future<List<CompanyService>> getCompaniesOfferingService(String serviceId) {
    return _run(
      () => _remoteDataSource.getCompaniesOfferingService(serviceId),
    );
  }

  @override
  Stream<List<CompanyService>> watchActiveServicesForCompany(String companyId) {
    return _remoteDataSource
        .watchActiveServicesForCompany(companyId)
        .handleError(_throwMappedError);
  }

  @override
  Stream<List<CompanyService>> watchCompaniesOfferingService(String serviceId) {
    return _remoteDataSource
        .watchCompaniesOfferingService(serviceId)
        .handleError(_throwMappedError);
  }

  Future<T> _run<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on CompanyServiceException {
      rethrow;
    } catch (_) {
      throw const CompanyServiceException(
        'Could not complete the company service request. Please try again.',
        code: 'unknown',
      );
    }
  }

  Never _throwMappedError(Object error, StackTrace stackTrace) {
    if (error is CompanyServiceException) {
      throw error;
    }
    throw const CompanyServiceException(
      'Could not load company services. Please try again.',
      code: 'unknown',
    );
  }
}
