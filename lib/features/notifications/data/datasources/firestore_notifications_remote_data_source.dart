import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/app_notification.dart';
import '../models/app_notification_model.dart';
import 'notifications_remote_data_source.dart';

class FirestoreNotificationsRemoteDataSource
    implements NotificationsRemoteDataSource {
  FirestoreNotificationsRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _collection = 'notifications';
  final FirebaseFirestore _firestore;

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
  Future<void> createNotification(AppNotification notification) async {
    try {
      await _notifications
          .doc(notification.id)
          .set(AppNotificationModel.toFirestoreCreateMap(notification));
    } on FirebaseException catch (error) {
      // Notifications are a best-effort side effect of an already-successful
      // action (order created, payment confirmed, ...); a permission or
      // network failure here must not surface as an error to the user, but
      // it is still logged so it isn't silently lost.
      // ignore: avoid_print
      print('[DIAG][NotificationsDS] createNotification failed: '
          '${error.code} ${error.message}');
    }
  }

  @override
  Future<void> markAsRead(String notificationId) async {
    try {
      await _notifications.doc(notificationId).update({'isRead': true});
    } on FirebaseException catch (error) {
      // ignore: avoid_print
      print('[DIAG][NotificationsDS] markAsRead failed: '
          '${error.code} ${error.message}');
    }
  }
}
