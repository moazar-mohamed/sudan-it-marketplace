import 'chat_conversation.dart';

/// One text message in a service-request conversation.
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.senderRole,
    required this.senderName,
    required this.text,
    required this.createdAt,
    this.isPending = false,
  });

  final String id;
  final String senderId;
  final ChatParticipantRole senderRole;
  final String senderName;
  final String text;
  final DateTime createdAt;

  /// Written on this device but not yet confirmed by the server.
  final bool isPending;

  /// Longest message the app (and the security rules) accept.
  static const maxLength = 2000;
}
