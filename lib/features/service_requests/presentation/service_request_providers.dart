import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../chats/presentation/chat_providers.dart';
import '../data/datasources/firestore_service_requests_remote_data_source.dart';
import '../data/datasources/service_requests_remote_data_source.dart';
import '../data/repositories/service_requests_repository_impl.dart';
import '../domain/entities/service_request.dart';
import '../domain/repositories/service_requests_repository.dart';

final serviceRequestsRemoteDataSourceProvider =
    Provider<ServiceRequestsRemoteDataSource>((ref) {
  return FirestoreServiceRequestsRemoteDataSource();
});

final serviceRequestsRepositoryProvider =
    Provider<ServiceRequestsRepository>((ref) {
  return ServiceRequestsRepositoryImpl(
    ref.watch(serviceRequestsRemoteDataSourceProvider),
  );
});

/// The signed-in customer's service requests, newest first.
final customerServiceRequestsStreamProvider =
    StreamProvider<List<ServiceRequest>>((ref) {
  final customerId = ref.watch(currentUserIdProvider);
  if (customerId == null || customerId.isEmpty) {
    return Stream.value(const []);
  }
  return ref
      .watch(serviceRequestsRepositoryProvider)
      .watchCustomerServiceRequests(customerId);
});

/// Every service request sent to [companyId], newest first.
final companyServiceRequestsStreamProvider =
    StreamProvider.family<List<ServiceRequest>, String>((ref, companyId) {
  if (companyId.isEmpty) {
    return Stream.value(const []);
  }
  return ref
      .watch(serviceRequestsRepositoryProvider)
      .watchCompanyServiceRequests(companyId);
});

/// How many requests sent to [companyId] still wait for the company's answer
/// (0 while loading or on error).
final companyPendingServiceRequestsCountProvider =
    Provider.family<int, String>((ref, companyId) {
  final requests =
      ref.watch(companyServiceRequestsStreamProvider(companyId)).asData?.value;
  return requests
          ?.where((request) => request.status == ServiceRequestStatus.pending)
          .length ??
      0;
});

final serviceRequestStreamProvider =
    StreamProvider.family<ServiceRequest?, String>((ref, requestId) {
  return ref
      .watch(serviceRequestsRepositoryProvider)
      .watchServiceRequest(requestId);
});
