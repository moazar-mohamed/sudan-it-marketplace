import '../../domain/entities/service_request.dart';
import '../../domain/repositories/service_requests_repository.dart';
import '../datasources/service_requests_remote_data_source.dart';

class ServiceRequestsRepositoryImpl implements ServiceRequestsRepository {
  const ServiceRequestsRepositoryImpl(this._remoteDataSource);

  final ServiceRequestsRemoteDataSource _remoteDataSource;

  @override
  String newServiceRequestId() => _remoteDataSource.newServiceRequestId();

  @override
  Future<void> createServiceRequest(ServiceRequest request) =>
      _remoteDataSource.createServiceRequest(request);

  @override
  Stream<List<ServiceRequest>> watchCustomerServiceRequests(
    String customerId,
  ) =>
      _remoteDataSource.watchCustomerServiceRequests(customerId);

  @override
  Stream<List<ServiceRequest>> watchCompanyServiceRequests(String companyId) =>
      _remoteDataSource.watchCompanyServiceRequests(companyId);

  @override
  Stream<ServiceRequest?> watchServiceRequest(String requestId) =>
      _remoteDataSource.watchServiceRequest(requestId);

  @override
  Future<void> updateStatus({
    required String requestId,
    required ServiceRequestStatus status,
  }) =>
      _remoteDataSource.updateStatus(requestId: requestId, status: status);
}
