/// Which side of an order's customer-technician conversation wrote a message.
enum TechChatRole {
  customer('customer'),
  technician('technician');

  const TechChatRole(this.value);

  final String value;

  static TechChatRole? fromValue(Object? value) {
    for (final role in values) {
      if (role.value == value) return role;
    }
    return null;
  }
}

/// Who is looking at the conversation: one of its two sides, or the order's
/// company, which reads it but never writes in it.
enum TechChatViewer {
  customer,
  technician,
  company;

  /// The side this viewer writes as (null for the company: read only).
  TechChatRole? get role => switch (this) {
        TechChatViewer.customer => TechChatRole.customer,
        TechChatViewer.technician => TechChatRole.technician,
        TechChatViewer.company => null,
      };
}

/// The conversation between an order's customer and the technician the
/// company sent for it (`customerTechChats/{orderId}`). It is open from the
/// assignment until the order is completed or cancelled, then read only. No
/// phone number is in it.
class TechChat {
  const TechChat({
    required this.id,
    required this.companyId,
    required this.customerId,
    required this.productName,
    this.lastMessageText,
    this.lastMessageAt,
    this.lastMessageSenderRole,
    this.customerLastReadAt,
    this.technicianLastReadAt,
  });

  final String id;
  final String companyId;
  final String customerId;
  final String productName;
  final String? lastMessageText;
  final DateTime? lastMessageAt;
  final TechChatRole? lastMessageSenderRole;
  final DateTime? customerLastReadAt;
  final DateTime? technicianLastReadAt;

  /// True when the other side wrote the latest message and [role] has not
  /// opened the conversation since.
  bool isUnreadFor(TechChatRole role) {
    final lastAt = lastMessageAt;
    if (lastAt == null || lastMessageSenderRole == null) return false;
    if (lastMessageSenderRole == role) return false;
    final readAt = role == TechChatRole.customer
        ? customerLastReadAt
        : technicianLastReadAt;
    return readAt == null || readAt.isBefore(lastAt);
  }
}

class TechChatMessage {
  const TechChatMessage({
    required this.id,
    required this.senderId,
    required this.senderRole,
    required this.senderName,
    required this.text,
    required this.createdAt,
    this.isPending = false,
  });

  /// Longest message the app (and the security rules) accept.
  static const maxLength = 2000;

  final String id;
  final String senderId;
  final TechChatRole senderRole;
  final String senderName;
  final String text;
  final DateTime createdAt;
  final bool isPending;
}
