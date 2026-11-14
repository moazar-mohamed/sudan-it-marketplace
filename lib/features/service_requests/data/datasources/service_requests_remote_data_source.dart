import '../../domain/entities/service_request.dart';

abstract class ServiceRequestsRemoteDataSource {
  String newServiceRequestId();

  /// Writes the request and its conversation together.
  Future<void> createServiceRequest(ServiceRequest request);

  Stream<List<ServiceRequest>> watchCustomerServiceRequests(String customerId);

  Stream<List<ServiceRequest>> watchCompanyServiceRequests(String companyId);

  Stream<ServiceRequest?> watchServiceRequest(String requestId);

  Future<void> updateStatus({
    required String requestId,
    required ServiceRequestStatus status,
  });
}
