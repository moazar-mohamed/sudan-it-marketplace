import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/errors/app_exception.dart';
import '../../domain/entities/chat_conversation.dart';
import '../../domain/entities/chat_message.dart';
import '../models/chat_models.dart';
import 'chats_remote_data_source.dart';

class FirestoreChatsRemoteDataSource implements ChatsRemoteDataSource {
  FirestoreChatsRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _chatsCollection = 'chats';
  static const _messagesCollection = 'messages';

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _chats =>
      _firestore.collection(_chatsCollection);

  @override
  Stream<List<ChatConversation>> watchCustomerConversations(
    String customerId,
  ) {
    return _watchList(_chats.where('customerId', isEqualTo: customerId));
  }

  @override
  Stream<List<ChatConversation>> watchCompanyConversations(String companyId) {
    return _watchList(_chats.where('companyId', isEqualTo: companyId));
  }

  /// Sorted here (most recent activity first) so no composite index is needed.
  Stream<List<ChatConversation>> _watchList(
    Query<Map<String, dynamic>> query,
  ) {
    return query
        .snapshots()
        .map((snapshot) {
          return snapshot.docs.map(ChatModels.conversationFromFirestore).toList()
            ..sort((a, b) => b.activityAt.compareTo(a.activityAt));
        })
        .handleError(_throwLoadError);
  }

  @override
  Stream<ChatConversation?> watchConversation(String chatId) {
    return _chats
        .doc(chatId)
        .snapshots()
        .map(
          (snapshot) => snapshot.exists
              ? ChatModels.conversationFromFirestore(snapshot)
              : null,
        )
        .handleError(_throwLoadError);
  }

  @override
  Stream<List<ChatMessage>> watchMessages(String chatId) {
    return _chats
        .doc(chatId)
        .collection(_messagesCollection)
        .orderBy('createdAt')
        .snapshots(includeMetadataChanges: true)
        .map(
          (snapshot) =>
              snapshot.docs.map(ChatModels.messageFromFirestore).toList(),
        )
        .handleError(_throwLoadError);
  }

  /// The message and the conversation's "last message" are written in one
  /// batch (the security rules require both together), and the sender's own
  /// read marker moves with it.
  @override
  Future<void> sendMessage({
    required String chatId,
    required String senderId,
    required ChatParticipantRole senderRole,
    required String senderName,
    required String text,
  }) async {
    final chatRef = _chats.doc(chatId);
    final messageRef = chatRef.collection(_messagesCollection).doc();
    final batch = _firestore.batch()
      ..set(messageRef, {
        'id': messageRef.id,
        'senderId': senderId,
        'senderRole': senderRole.value,
        'senderName': senderName,
        'text': text,
        'createdAt': FieldValue.serverTimestamp(),
      })
      ..update(chatRef, {
        'lastMessageId': messageRef.id,
        'lastMessageText': text,
        'lastMessageAt': FieldValue.serverTimestamp(),
        'lastMessageSenderRole': senderRole.value,
        'updatedAt': FieldValue.serverTimestamp(),
        ChatModels.readKeyFor(senderRole): FieldValue.serverTimestamp(),
      });
    try {
      await batch.commit();
    } on FirebaseException catch (error) {
      throw AppException(
        error.code == 'permission-denied'
            ? AppErrorCode.chatSendDenied
            : AppErrorCode.chatSendFailed,
        detail: error.code,
      );
    }
  }

  @override
  Future<void> markRead({
    required String chatId,
    required ChatParticipantRole role,
  }) async {
    try {
      await _chats.doc(chatId).update({
        ChatModels.readKeyFor(role): FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      // Only the unread badge depends on this; it is retried the next time
      // the conversation is opened.
      throw AppException(AppErrorCode.chatSendFailed, detail: error.code);
    }
  }

  Never _throwLoadError(Object error, StackTrace stackTrace) {
    throw AppException(
      AppErrorCode.chatLoadFailed,
      detail: error is FirebaseException ? error.code : '$error',
    );
  }
}
