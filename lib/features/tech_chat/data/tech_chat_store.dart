import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../core/errors/app_exception.dart';
import '../domain/tech_chat.dart';

/// Reads and writes `customerTechChats/{orderId}` and its `messages`.
class TechChatStore {
  TechChatStore({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  DocumentReference<Map<String, dynamic>> _chat(String orderId) =>
      _firestore.collection('customerTechChats').doc(orderId);

  /// Null until the first message is written (the conversation is created
  /// with it). The rules refuse a read of a conversation that does not exist
  /// yet, which here means "nothing said so far".
  Stream<TechChat?> watchChat(String orderId) {
    return _chat(orderId)
        .snapshots()
        .map<TechChat?>((snapshot) {
          if (!snapshot.exists) return null;
          final data = snapshot.data() ?? {};
          DateTime? at(String key) {
            final value = data[key];
            return value is Timestamp ? value.toDate() : null;
          }

          return TechChat(
            id: snapshot.id,
            companyId: data['companyId'] as String? ?? '',
            customerId: data['customerId'] as String? ?? '',
            productName: data['productName'] as String? ?? '',
            lastMessageText: data['lastMessageText'] as String?,
            lastMessageAt: at('lastMessageAt'),
            lastMessageSenderRole:
                TechChatRole.fromValue(data['lastMessageSenderRole']),
            customerLastReadAt: at('customerLastReadAt'),
            technicianLastReadAt: at('technicianLastReadAt'),
          );
        })
        .transform(_ignorePermissionDenied<TechChat?>());
  }

  Stream<List<TechChatMessage>> watchMessages(String orderId) {
    return _chat(orderId)
        .collection('messages')
        .orderBy('createdAt')
        .snapshots(includeMetadataChanges: true)
        .map((snapshot) {
          return [
            for (final doc in snapshot.docs)
              if (TechChatRole.fromValue(doc.data()['senderRole']) != null)
                _message(doc),
          ];
        })
        .transform(_ignorePermissionDenied<List<TechChatMessage>>());
  }

  /// Before the first message there is no conversation, and the rules answer
  /// a read of it with permission-denied: that is "nothing yet", not a fault.
  StreamTransformer<T, T> _ignorePermissionDenied<T>() {
    return StreamTransformer<T, T>.fromHandlers(
      handleError: (error, stackTrace, sink) {
        if (error is FirebaseException && error.code == 'permission-denied') {
          return;
        }
        sink.addError(error, stackTrace);
      },
    );
  }

  TechChatMessage _message(QueryDocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    final createdAt = data['createdAt'];
    return TechChatMessage(
      id: doc.id,
      senderId: data['senderId'] as String? ?? '',
      senderRole: TechChatRole.fromValue(data['senderRole'])!,
      senderName: data['senderName'] as String? ?? '',
      text: data['text'] as String? ?? '',
      createdAt: createdAt is Timestamp ? createdAt.toDate() : DateTime.now(),
      isPending: doc.metadata.hasPendingWrites,
    );
  }

  /// Writes the message and the conversation together (the security rules
  /// require both). [existing] says whether the conversation is there yet.
  Future<String> send({
    required String orderId,
    required String companyId,
    required String customerId,
    required String productName,
    required String senderId,
    required TechChatRole senderRole,
    required String senderName,
    required String text,
    required bool existing,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || trimmed.length > TechChatMessage.maxLength) {
      throw const AppException(AppErrorCode.chatMessageInvalid);
    }
    final chatRef = _chat(orderId);
    final messageRef = chatRef.collection('messages').doc();
    final last = <String, dynamic>{
      'lastMessageId': messageRef.id,
      'lastMessageText': trimmed,
      'lastMessageAt': FieldValue.serverTimestamp(),
      'lastMessageSenderRole': senderRole.value,
      'updatedAt': FieldValue.serverTimestamp(),
      _readKey(senderRole): FieldValue.serverTimestamp(),
    };
    final name = senderName.trim();
    final batch = _firestore.batch()
      ..set(messageRef, {
        'id': messageRef.id,
        'senderId': senderId,
        'senderRole': senderRole.value,
        'senderName': name.length > 200 ? name.substring(0, 200) : name,
        'text': trimmed,
        'createdAt': FieldValue.serverTimestamp(),
      });
    if (existing) {
      batch.update(chatRef, last);
    } else {
      batch.set(chatRef, {
        'id': orderId,
        'orderId': orderId,
        'companyId': companyId,
        'customerId': customerId,
        'productName': productName,
        'createdAt': FieldValue.serverTimestamp(),
        ...last,
      });
    }
    try {
      await batch.commit();
      return messageRef.id;
    } on FirebaseException catch (error) {
      throw AppException(
        error.code == 'permission-denied'
            ? AppErrorCode.chatSendDenied
            : AppErrorCode.chatSendFailed,
        detail: error.code,
      );
    }
  }

  /// Best effort: a failure only leaves the unread dot on.
  Future<void> markRead({
    required String orderId,
    required TechChatRole role,
  }) async {
    try {
      await _chat(orderId).update({_readKey(role): FieldValue.serverTimestamp()});
    } on FirebaseException {
      // Retried the next time the conversation is opened.
    }
  }

  static String _readKey(TechChatRole role) => role == TechChatRole.customer
      ? 'customerLastReadAt'
      : 'technicianLastReadAt';
}
