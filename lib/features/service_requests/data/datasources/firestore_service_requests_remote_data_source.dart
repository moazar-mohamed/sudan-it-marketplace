import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../chats/data/models/chat_models.dart';
import '../../domain/entities/service_request.dart';
import '../models/service_request_model.dart';
import 'service_requests_remote_data_source.dart';

class FirestoreServiceRequestsRemoteDataSource
    implements ServiceRequestsRemoteDataSource {
  FirestoreServiceRequestsRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _requestsCollection = 'service_requests';
  static const _chatsCollection = 'chats';

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _requests =>
      _firestore.collection(_requestsCollection);

  @override
  String newServiceRequestId() => _requests.doc().id;

  /// The request and its conversation (same id) are one batch: the security
  /// rules only accept each of them together with the other, so a request
  /// never exists without its chat.
  @override
  Future<void> createServiceRequest(ServiceRequest request) async {
    final requestRef = _requests.doc(request.id);
    final chatRef = _firestore.collection(_chatsCollection).doc(request.id);
    final batch = _firestore.batch()
      ..set(requestRef, ServiceRequestModel.toCreateMap(request))
      ..set(
        chatRef,
        ChatModels.conversationCreateMap(
          serviceRequestId: request.id,
          customerId: request.customerId,
          companyId: request.companyId,
          customerName: request.customerName.trim(),
          companyName: request.companyName,
          serviceName: request.serviceName,
        ),
      );
    try {
      await batch.commit();
    } on FirebaseException catch (error) {
      throw AppException(
        error.code == 'permission-denied'
            ? AppErrorCode.serviceRequestCreateDenied
            : AppErrorCode.serviceRequestCreateFailed,
        detail: error.code,
      );
    }
  }

  @override
  Stream<List<ServiceRequest>> watchCustomerServiceRequests(
    String customerId,
  ) {
    return _watchList(_requests.where('customerId', isEqualTo: customerId));
  }

  @override
  Stream<List<ServiceRequest>> watchCompanyServiceRequests(String companyId) {
    return _watchList(_requests.where('companyId', isEqualTo: companyId));
  }

  /// Newest first, sorted here so no composite index is needed.
  Stream<List<ServiceRequest>> _watchList(
    Query<Map<String, dynamic>> query,
  ) {
    return query
        .snapshots()
        .map((snapshot) {
          return snapshot.docs.map(ServiceRequestModel.fromFirestore).toList()
            ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        })
        .handleError(_throwLoadError);
  }

  @override
  Stream<ServiceRequest?> watchServiceRequest(String requestId) {
    return _requests
        .doc(requestId)
        .snapshots()
        .map(
          (snapshot) => snapshot.exists
              ? ServiceRequestModel.fromFirestore(snapshot)
              : null,
        )
        .handleError(_throwLoadError);
  }

  @override
  Future<void> updateStatus({
    required String requestId,
    required ServiceRequestStatus status,
  }) async {
    try {
      await _requests.doc(requestId).update({
        'status': status.value,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw AppException(
        error.code == 'permission-denied'
            ? AppErrorCode.serviceRequestUpdateDenied
            : AppErrorCode.serviceRequestUpdateFailed,
        detail: error.code,
      );
    }
  }

  Never _throwLoadError(Object error, StackTrace stackTrace) {
    throw AppException(
      AppErrorCode.serviceRequestLoadFailed,
      detail: error is FirebaseException ? error.code : '$error',
    );
  }
}
