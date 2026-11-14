import '../entities/service_request.dart';

abstract class ServiceRequestsRepository {
  String newServiceRequestId();

  /// Sends [request] to its company and opens its conversation.
  Future<void> createServiceRequest(ServiceRequest request);

  Stream<List<ServiceRequest>> watchCustomerServiceRequests(String customerId);

  Stream<List<ServiceRequest>> watchCompanyServiceRequests(String companyId);

  Stream<ServiceRequest?> watchServiceRequest(String requestId);

  Future<void> updateStatus({
    required String requestId,
    required ServiceRequestStatus status,
  });
}
