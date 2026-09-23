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

/// The conversation of one service request, between its customer and the
/// company it was sent to. It has the same id as the service request and
/// never exists without one.
class ChatConversation {
  const ChatConversation({
    required this.id,
    required this.serviceRequestId,
    required this.customerId,
    required this.companyId,
    required this.customerName,
    required this.companyName,
    required this.serviceName,
    required this.createdAt,
    this.lastMessageText,
    this.lastMessageAt,
    this.lastMessageSenderRole,
    this.customerLastReadAt,
    this.companyLastReadAt,
  });

  final String id;
  final String serviceRequestId;
  final String customerId;
  final String companyId;
  final String customerName;
  final String companyName;
  final String serviceName;
  final DateTime createdAt;
  final String? lastMessageText;
  final DateTime? lastMessageAt;
  final ChatParticipantRole? lastMessageSenderRole;
  final DateTime? customerLastReadAt;
  final DateTime? companyLastReadAt;

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
