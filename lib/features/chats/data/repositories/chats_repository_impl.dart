import '../../../../core/errors/app_exception.dart';
import '../../domain/entities/chat_conversation.dart';
import '../../domain/entities/chat_message.dart';
import '../../domain/repositories/chats_repository.dart';
import '../datasources/chats_remote_data_source.dart';

class ChatsRepositoryImpl implements ChatsRepository {
  const ChatsRepositoryImpl(this._remoteDataSource);

  final ChatsRemoteDataSource _remoteDataSource;

  @override
  Stream<List<ChatConversation>> watchCustomerConversations(
    String customerId,
  ) =>
      _remoteDataSource.watchCustomerConversations(customerId);

  @override
  Stream<List<ChatConversation>> watchCompanyConversations(String companyId) =>
      _remoteDataSource.watchCompanyConversations(companyId);

  @override
  Stream<ChatConversation?> watchConversation(String chatId) =>
      _remoteDataSource.watchConversation(chatId);

  @override
  Stream<List<ChatMessage>> watchMessages(String chatId) =>
      _remoteDataSource.watchMessages(chatId);

  @override
  Future<void> sendMessage({
    required String chatId,
    required String senderId,
    required ChatParticipantRole senderRole,
    required String senderName,
    required String text,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || trimmed.length > ChatMessage.maxLength) {
      throw const AppException(AppErrorCode.chatMessageInvalid);
    }
    await _remoteDataSource.sendMessage(
      chatId: chatId,
      senderId: senderId,
      senderRole: senderRole,
      senderName: senderName.trim(),
      text: trimmed,
    );
  }

  @override
  Future<void> markRead({
    required String chatId,
    required ChatParticipantRole role,
  }) =>
      _remoteDataSource.markRead(chatId: chatId, role: role);
}
