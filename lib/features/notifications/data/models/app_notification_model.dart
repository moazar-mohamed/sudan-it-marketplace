import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/app_notification.dart';

class AppNotificationModel {
  static AppNotification fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? {};
    final createdAt = data['createdAt'];
    return AppNotification(
      id: snapshot.id,
      recipientType: NotificationRecipientType.fromFirestoreValue(
        data['recipientType'] as String? ?? 'customer',
      ),
      recipientId: data['recipientId'] as String? ?? '',
      orderId: data['orderId'] as String? ?? '',
      type: data['type'] as String? ?? '',
      title: data['title'] as String? ?? '',
      body: data['body'] as String? ?? '',
      isRead: data['isRead'] as bool? ?? false,
      createdAt: createdAt is Timestamp
          ? createdAt.toDate()
          : DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  /// [senderId] is the signed-in user creating it (the push relay only
  /// sends a notification for its own sender).
  static Map<String, dynamic> toFirestoreCreateMap(
    AppNotification notification, {
    String? senderId,
  }) {
    return {
      'id': notification.id,
      'recipientType': notification.recipientType.firestoreValue,
      'recipientId': notification.recipientId,
      'orderId': notification.orderId,
      'type': notification.type,
      'title': notification.title,
      'body': notification.body,
      'isRead': false,
      'createdAt': FieldValue.serverTimestamp(),
      'senderId': ?senderId,
    };
  }
}
