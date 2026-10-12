import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../core/errors/app_exception.dart';
import '../domain/technician_note.dart';

/// Reads and writes `orders/{orderId}/technicianNotes`.
class TechnicianNotesStore {
  TechnicianNotesStore({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> _notes(String orderId) =>
      _firestore.collection('orders').doc(orderId).collection('technicianNotes');

  /// Newest first. Sorted here so no index is needed.
  Stream<List<TechnicianNote>> watch(String orderId) {
    return _notes(orderId).snapshots().map((snapshot) {
      final notes = snapshot.docs.map(_fromDoc).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return notes;
    });
  }

  Future<void> add({
    required String orderId,
    required String companyId,
    required String technicianId,
    required String authorId,
    required String authorName,
    required TechnicianNoteKind kind,
    required String text,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || trimmed.length > TechnicianNote.maxLength) {
      throw const AppException(AppErrorCode.chatMessageInvalid);
    }
    final ref = _notes(orderId).doc();
    try {
      await ref.set({
        'id': ref.id,
        'orderId': orderId,
        'companyId': companyId,
        'technicianId': technicianId,
        'authorId': authorId,
        'authorName': authorName.trim(),
        'kind': kind.value,
        'text': trimmed,
        'createdAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw AppException(
        error.code == 'permission-denied'
            ? AppErrorCode.chatSendDenied
            : AppErrorCode.chatSendFailed,
        detail: error.code,
      );
    }
  }

  Future<void> delete({required String orderId, required String noteId}) async {
    try {
      await _notes(orderId).doc(noteId).delete();
    } on FirebaseException catch (error) {
      throw AppException(
        error.code == 'permission-denied'
            ? AppErrorCode.chatSendDenied
            : AppErrorCode.chatSendFailed,
        detail: error.code,
      );
    }
  }

  TechnicianNote _fromDoc(QueryDocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    final createdAt = data['createdAt'];
    return TechnicianNote(
      id: doc.id,
      orderId: data['orderId'] as String? ?? '',
      authorId: data['authorId'] as String? ?? '',
      authorName: data['authorName'] as String? ?? '',
      kind: TechnicianNoteKind.fromValue(data['kind']),
      text: data['text'] as String? ?? '',
      // A note this device just wrote has no server time yet.
      createdAt: createdAt is Timestamp ? createdAt.toDate() : DateTime.now(),
    );
  }
}
