import '../../domain/entities/chat_conversation.dart';
import '../../domain/entities/chat_message.dart';

abstract class ChatsRemoteDataSource {
  Stream<List<ChatConversation>> watchCustomerConversations(String customerId);

  Stream<List<ChatConversation>> watchCompanyConversations(String companyId);

  Stream<ChatConversation?> watchConversation(String chatId);

  Stream<List<ChatMessage>> watchMessages(String chatId);

  /// Returns the new message's id.
  Future<String> sendMessage({
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

  Future<void> openProductInquiry({
    required String customerId,
    required String customerName,
    required String companyId,
    required String companyName,
    required String productId,
    required String productName,
  });

  Future<void> openServiceInquiry({
    required String customerId,
    required String customerName,
    required String companyId,
    required String companyName,
    required String companyServiceId,
    required String serviceName,
  });
}
