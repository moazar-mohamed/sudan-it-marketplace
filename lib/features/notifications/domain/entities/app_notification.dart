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
///
/// It carries no text of its own: [type] says what happened and the words
/// are built from it and [productName] (the order's product, or the service
/// of a service request; the security rules check it against the order or the
/// request) in the reader's language. So a sender can never write a message
/// of their own. It is about an order ([orderId]) or about a service request
/// ([serviceRequestId]); exactly one of the two is set.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.recipientType,
    required this.recipientId,
    this.orderId = '',
    this.serviceRequestId = '',
    required this.type,
    this.productName = '',
    this.isRead = false,
    required this.createdAt,
  });

  /// The id of the one notification of [type] an order can have (one per
  /// technician for an assignment). The security rules require exactly this
  /// id, so the same thing cannot be sent twice.
  static String idFor({
    required String orderId,
    required String type,
    required NotificationRecipientType recipientType,
    required String recipientId,
  }) =>
      recipientType == NotificationRecipientType.technician
          ? '${orderId}_${type}_$recipientId'
          : '${orderId}_$type';

  /// The id of the one notification of [type] a service request can have.
  /// The security rules require exactly this id.
  static String idForServiceRequest({
    required String serviceRequestId,
    required String type,
  }) =>
      '${serviceRequestId}_$type';

  final String id;
  final NotificationRecipientType recipientType;
  final String recipientId;
  final String orderId;
  final String serviceRequestId;
  final String type;

  /// Empty for a notification stored before product names were kept apart.
  final String productName;
  final bool isRead;
  final DateTime createdAt;

  AppNotification copyWith({bool? isRead}) {
    return AppNotification(
      id: id,
      recipientType: recipientType,
      recipientId: recipientId,
      orderId: orderId,
      serviceRequestId: serviceRequestId,
      type: type,
      productName: productName,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
    );
  }
}
