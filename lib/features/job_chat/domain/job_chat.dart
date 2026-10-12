/// Which side of a job conversation a user speaks for.
enum JobChatRole {
  technician('technician'),
  company('company');

  const JobChatRole(this.value);

  final String value;

  static JobChatRole? fromValue(Object? value) {
    for (final role in values) {
      if (role.value == value) return role;
    }
    return null;
  }
}

/// The conversation between the technician of a job and the company, with the
/// order's id. The customer never sees it.
class JobChat {
  const JobChat({
    required this.id,
    required this.companyId,
    required this.technicianId,
    required this.technicianName,
    required this.productName,
    this.lastMessageText,
    this.lastMessageAt,
    this.lastMessageSenderRole,
    this.technicianLastReadAt,
    this.companyLastReadAt,
  });

  final String id;
  final String companyId;
  final String technicianId;
  final String technicianName;
  final String productName;
  final String? lastMessageText;
  final DateTime? lastMessageAt;
  final JobChatRole? lastMessageSenderRole;
  final DateTime? technicianLastReadAt;
  final DateTime? companyLastReadAt;

  /// True when the other side wrote the latest message and [role] has not
  /// opened the conversation since.
  bool isUnreadFor(JobChatRole role) {
    final lastAt = lastMessageAt;
    if (lastAt == null || lastMessageSenderRole == null) return false;
    if (lastMessageSenderRole == role) return false;
    final readAt =
        role == JobChatRole.technician ? technicianLastReadAt : companyLastReadAt;
    return readAt == null || readAt.isBefore(lastAt);
  }
}

class JobChatMessage {
  const JobChatMessage({
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
  final JobChatRole senderRole;
  final String senderName;
  final String text;
  final DateTime createdAt;
  final bool isPending;
}
