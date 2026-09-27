/// Which side of a service-request conversation a user speaks for.
enum ChatParticipantRole {
  customer('customer'),
  company('company');

  const ChatParticipantRole(this.value);

  final String value;

  static ChatParticipantRole? fromValue(String? value) {
    for (final role in values) {
      if (role.value == value) return role;
    }
    return null;
  }
}

/// The conversation between a customer and the company they contacted, about
/// either a service request or a product order - told apart by which of
/// [serviceRequestId]/[orderId] is set. It has the same id as the service
/// request or order it belongs to, and never exists without one.
class ChatConversation {
  const ChatConversation({
    required this.id,
    this.serviceRequestId,
    this.orderId,
    required this.customerId,
    required this.companyId,
    required this.customerName,
    required this.companyName,
    this.serviceName = '',
    this.productName = '',
    required this.createdAt,
    this.lastMessageText,
    this.lastMessageAt,
    this.lastMessageSenderRole,
    this.customerLastReadAt,
    this.companyLastReadAt,
  });

  final String id;
  final String? serviceRequestId;
  final String? orderId;
  final String customerId;
  final String companyId;
  final String customerName;
  final String companyName;

  /// The service it is about; empty for an order's conversation.
  final String serviceName;

  /// The product it is about; empty for a service request's conversation.
  final String productName;
  final DateTime createdAt;
  final String? lastMessageText;
  final DateTime? lastMessageAt;
  final ChatParticipantRole? lastMessageSenderRole;
  final DateTime? customerLastReadAt;
  final DateTime? companyLastReadAt;

  bool get isOrderChat => orderId != null;

  /// What the conversation is about: the service name, or the product name.
  String get subjectLabel => isOrderChat ? productName : serviceName;

  /// When anything last happened here (used to order the conversation list).
  DateTime get activityAt => lastMessageAt ?? createdAt;

  bool get hasMessages => lastMessageAt != null;

  /// True when the other side wrote the latest message and [role] has not
  /// opened the conversation since.
  bool isUnreadFor(ChatParticipantRole role) {
    final lastAt = lastMessageAt;
    if (lastAt == null || lastMessageSenderRole == null) return false;
    if (lastMessageSenderRole == role) return false;
    final readAt = role == ChatParticipantRole.customer
        ? customerLastReadAt
        : companyLastReadAt;
    return readAt == null || readAt.isBefore(lastAt);
  }
}
