import '../../domain/entities/chat_conversation.dart';
import '../../domain/entities/chat_message.dart';

abstract class ChatsRemoteDataSource {
  Stream<List<ChatConversation>> watchCustomerConversations(String customerId);

  Stream<List<ChatConversation>> watchCompanyConversations(String companyId);

  Stream<ChatConversation?> watchConversation(String chatId);

  Stream<List<ChatMessage>> watchMessages(String chatId);

  Future<void> sendMessage({
    required String chatId,
    required String senderId,
    required ChatParticipantRole senderRole,
    required String senderName,
    required String text,
  });

  Future<void> markRead({
    required String chatId,
    required ChatParticipantRole role,
  });
}
