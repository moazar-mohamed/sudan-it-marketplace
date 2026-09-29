import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../domain/entities/app_notification.dart';
import '../models/app_notification_model.dart';
import 'notifications_remote_data_source.dart';
import '../../../../core/logging/debug_log.dart';

class FirestoreNotificationsRemoteDataSource
    implements NotificationsRemoteDataSource {
  FirestoreNotificationsRemoteDataSource({
    FirebaseFirestore? firestore,
    String? Function()? currentUserId,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _currentUserId =
            currentUserId ?? (() => FirebaseAuth.instance.currentUser?.uid);

  static const _collection = 'notifications';
  final FirebaseFirestore _firestore;
  final String? Function() _currentUserId;

  CollectionReference<Map<String, dynamic>> get _notifications =>
      _firestore.collection(_collection);

  List<AppNotification> _sorted(QuerySnapshot<Map<String, dynamic>> snapshot) {
    final list = snapshot.docs.map(AppNotificationModel.fromFirestore).toList();
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list;
  }

  Stream<List<AppNotification>> _watchFor({
    required String recipientType,
    required String recipientId,
  }) {
    if (recipientId.isEmpty) {
      return Stream.value(const []);
    }
    return _notifications
        .where('recipientType', isEqualTo: recipientType)
        .where('recipientId', isEqualTo: recipientId)
        .snapshots()
        .map(_sorted);
  }

  @override
  Stream<List<AppNotification>> watchCustomerNotifications(
    String customerId,
  ) =>
      _watchFor(recipientType: 'customer', recipientId: customerId);

  @override
  Stream<List<AppNotification>> watchCompanyNotifications(String companyId) =>
      _watchFor(recipientType: 'company_admin', recipientId: companyId);

  @override
  Stream<List<AppNotification>> watchTechnicianNotifications(
    String technicianId,
  ) =>
      _watchFor(recipientType: 'technician', recipientId: technicianId);

  @override
  String newNotificationId() => _notifications.doc().id;

  @override
  Future<bool> createNotification(AppNotification notification) async {
    try {
      await _notifications.doc(notification.id).set(
            AppNotificationModel.toFirestoreCreateMap(
              notification,
              senderId: _currentUserId(),
            ),
          );
      return true;
    } on FirebaseException catch (error) {
      // Notifications are a best-effort side effect of an already-successful
      // action (order created, payment confirmed, ...); a permission or
      // network failure here must not surface as an error to the user, but
      // it is still logged so it isn't silently lost.
      debugLog('NotificationsDS', 'createNotification failed: '
          '${error.code} ${error.message}');
      return false;
    }
  }

  @override
  Future<void> markAsRead(String notificationId) async {
    try {
      await _notifications.doc(notificationId).update({'isRead': true});
    } on FirebaseException catch (error) {
      debugLog('NotificationsDS', 'markAsRead failed: '
          '${error.code} ${error.message}');
    }
  }
}
