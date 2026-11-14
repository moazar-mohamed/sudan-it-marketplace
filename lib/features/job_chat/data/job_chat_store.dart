import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../core/errors/app_exception.dart';
import '../domain/job_chat.dart';

/// Reads and writes `jobChats/{orderId}` and its `messages`.
class JobChatStore {
  JobChatStore({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  DocumentReference<Map<String, dynamic>> _chat(String orderId) =>
      _firestore.collection('jobChats').doc(orderId);

  /// Null until the first message is written (the conversation is created
  /// with it). The rules refuse a read of a conversation that does not exist
  /// yet, which here means "nothing said so far".
  Stream<JobChat?> watchChat(String orderId) {
    return _chat(orderId)
        .snapshots()
        .map<JobChat?>((snapshot) {
          if (!snapshot.exists) return null;
          final data = snapshot.data() ?? {};
          DateTime? at(String key) {
            final value = data[key];
            return value is Timestamp ? value.toDate() : null;
          }

          return JobChat(
            id: snapshot.id,
            companyId: data['companyId'] as String? ?? '',
            technicianId: data['technicianId'] as String? ?? '',
            technicianName: data['technicianName'] as String? ?? '',
            productName: data['productName'] as String? ?? '',
            lastMessageText: data['lastMessageText'] as String?,
            lastMessageAt: at('lastMessageAt'),
            lastMessageSenderRole:
                JobChatRole.fromValue(data['lastMessageSenderRole']),
            technicianLastReadAt: at('technicianLastReadAt'),
            companyLastReadAt: at('companyLastReadAt'),
          );
        })
        .transform(_ignorePermissionDenied<JobChat?>());
  }

  Stream<List<JobChatMessage>> watchMessages(String orderId) {
    return _chat(orderId)
        .collection('messages')
        .orderBy('createdAt')
        .snapshots(includeMetadataChanges: true)
        .map((snapshot) {
          return [
            for (final doc in snapshot.docs)
              if (JobChatRole.fromValue(doc.data()['senderRole']) != null)
                _message(doc),
          ];
        })
        .transform(_ignorePermissionDenied<List<JobChatMessage>>());
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

  JobChatMessage _message(QueryDocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    final createdAt = data['createdAt'];
    return JobChatMessage(
      id: doc.id,
      senderId: data['senderId'] as String? ?? '',
      senderRole: JobChatRole.fromValue(data['senderRole'])!,
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
    required String technicianId,
    required String technicianName,
    required String productName,
    required String senderId,
    required JobChatRole senderRole,
    required String senderName,
    required String text,
    required bool existing,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || trimmed.length > JobChatMessage.maxLength) {
      throw const AppException(AppErrorCode.chatMessageInvalid);
    }
    final chatRef = _chat(orderId);
    final messageRef = chatRef.collection('messages').doc();
    final readKey = senderRole == JobChatRole.company
        ? 'companyLastReadAt'
        : 'technicianLastReadAt';
    final last = <String, dynamic>{
      'lastMessageId': messageRef.id,
      'lastMessageText': trimmed,
      'lastMessageAt': FieldValue.serverTimestamp(),
      'lastMessageSenderRole': senderRole.value,
      'updatedAt': FieldValue.serverTimestamp(),
      readKey: FieldValue.serverTimestamp(),
    };
    final batch = _firestore.batch()
      ..set(messageRef, {
        'id': messageRef.id,
        'senderId': senderId,
        'senderRole': senderRole.value,
        'senderName': senderName.trim(),
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
        'technicianId': technicianId,
        'technicianName': technicianName,
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
    required JobChatRole role,
  }) async {
    try {
      await _chat(orderId).update({
        role == JobChatRole.company
            ? 'companyLastReadAt'
            : 'technicianLastReadAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException {
      // Retried the next time the conversation is opened.
    }
  }
}
