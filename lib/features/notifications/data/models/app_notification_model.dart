import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/app_notification.dart';

class AppNotificationModel {
  static AppNotification fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) =>
      fromMap(snapshot.id, snapshot.data() ?? {});

  /// Any `title` or `body` on an older document is ignored on purpose: the
  /// words shown are always built from the type and the product name.
  static AppNotification fromMap(String id, Map<String, dynamic> data) {
    final createdAt = data['createdAt'];
    return AppNotification(
      id: id,
      recipientType: NotificationRecipientType.fromFirestoreValue(
        data['recipientType'] as String? ?? 'customer',
      ),
      recipientId: data['recipientId'] as String? ?? '',
      orderId: data['orderId'] as String? ?? '',
      serviceRequestId: data['serviceRequestId'] as String? ?? '',
      reportId: data['reportId'] as String? ?? '',
      productId: data['productId'] as String? ?? '',
      type: data['type'] as String? ?? '',
      productName: data['productName'] as String? ?? '',
      isRead: data['isRead'] as bool? ?? false,
      createdAt: createdAt is Timestamp
          ? createdAt.toDate()
          : DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  /// Exactly the fields the security rules accept (no free text). [senderId]
  /// is the signed-in user creating it (the push relay only sends a
  /// notification for its own sender).
  static Map<String, dynamic> toFirestoreCreateMap(
    AppNotification notification, {
    String? senderId,
  }) {
    return {
      'id': notification.id,
      'recipientType': notification.recipientType.firestoreValue,
      'recipientId': notification.recipientId,
      if (notification.orderId.isNotEmpty) 'orderId': notification.orderId,
      if (notification.serviceRequestId.isNotEmpty)
        'serviceRequestId': notification.serviceRequestId,
      if (notification.reportId.isNotEmpty) 'reportId': notification.reportId,
      if (notification.productId.isNotEmpty) 'productId': notification.productId,
      'type': notification.type,
      'productName': notification.productName,
      'isRead': false,
      'createdAt': FieldValue.serverTimestamp(),
      'senderId': ?senderId,
    };
  }
}
