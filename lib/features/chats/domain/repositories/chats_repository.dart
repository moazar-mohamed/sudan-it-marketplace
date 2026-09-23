import '../entities/chat_conversation.dart';
import '../entities/chat_message.dart';

abstract class ChatsRepository {
  Stream<List<ChatConversation>> watchCustomerConversations(String customerId);

  Stream<List<ChatConversation>> watchCompanyConversations(String companyId);

  Stream<ChatConversation?> watchConversation(String chatId);

  Stream<List<ChatMessage>> watchMessages(String chatId);

  /// Sends a text message as [senderRole]. [text] is trimmed; an empty or
  /// over-long text is rejected before anything is written.
  Future<void> sendMessage({
    required String chatId,
    required String senderId,
    required ChatParticipantRole senderRole,
    required String senderName,
    required String text,
  });

  /// Records that [role] has read the conversation up to now.
  Future<void> markRead({
    required String chatId,
    required ChatParticipantRole role,
  });
}
