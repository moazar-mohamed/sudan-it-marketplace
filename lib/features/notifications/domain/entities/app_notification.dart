enum NotificationRecipientType {
  customer('customer'),
  companyAdmin('company_admin'),
  technician('technician');

  const NotificationRecipientType(this.firestoreValue);

  final String firestoreValue;

  static NotificationRecipientType fromFirestoreValue(String value) {
    for (final type in NotificationRecipientType.values) {
      if (type.firestoreValue == value) {
        return type;
      }
    }
    throw FormatException('Unknown notification recipient type: $value');
  }
}

/// A persistent notification stored in Firestore. [recipientId] means a
/// different id depending on [recipientType]: the customer's uid, a
/// companyId (any admin of that company may read it), or a technicianId.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.recipientType,
    required this.recipientId,
    required this.orderId,
    required this.type,
    required this.title,
    required this.body,
    this.isRead = false,
    required this.createdAt,
  });

  final String id;
  final NotificationRecipientType recipientType;
  final String recipientId;
  final String orderId;
  final String type;
  final String title;
  final String body;
  final bool isRead;
  final DateTime createdAt;

  AppNotification copyWith({bool? isRead}) {
    return AppNotification(
      id: id,
      recipientType: recipientType,
      recipientId: recipientId,
      orderId: orderId,
      type: type,
      title: title,
      body: body,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
    );
  }
}
