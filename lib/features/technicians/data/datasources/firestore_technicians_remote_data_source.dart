import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/technician.dart';
import '../../domain/entities/technician_invite.dart';
import '../models/technician_model.dart';
import 'technicians_remote_data_source.dart';

class FirestoreTechniciansRemoteDataSource
    implements TechniciansRemoteDataSource {
  FirestoreTechniciansRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _techniciansCollection = 'technicians';
  static const _invitesCollection = 'technicianInvites';
  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _technicians =>
      _firestore.collection(_techniciansCollection);

  CollectionReference<Map<String, dynamic>> get _invites =>
      _firestore.collection(_invitesCollection);

  String _normalizeEmail(String email) => email.trim().toLowerCase();

  List<Technician> _sorted(QuerySnapshot<Map<String, dynamic>> snapshot) {
    final list = snapshot.docs.map(TechnicianModel.fromFirestore).toList();
    list.sort((a, b) {
      final aDate = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bDate = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bDate.compareTo(aDate);
    });
    return list;
  }

  @override
  Stream<List<Technician>> watchCompanyTechnicians(String companyId) {
    return _technicians
        .where('companyId', isEqualTo: companyId)
        .snapshots()
        .map(_sorted);
  }

  @override
  Stream<Technician?> watchSelfTechnician({
    required String companyId,
    required String email,
  }) {
    if (companyId.isEmpty || email.isEmpty) {
      return Stream.value(null);
    }
    return _technicians
        .where('companyId', isEqualTo: companyId)
        .where('email', isEqualTo: email)
        .limit(1)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.isEmpty
          ? null
          : TechnicianModel.fromFirestore(snapshot.docs.first);
    });
  }

  @override
  Stream<Technician?> watchTechnicianByUid(String uid) {
    if (uid.isEmpty) {
      return Stream.value(null);
    }
    return _technicians.doc(uid).snapshots().map(
          (doc) => doc.exists ? TechnicianModel.fromFirestore(doc) : null,
        );
  }

  @override
  String newTechnicianId() => _technicians.doc().id;

  @override
  Future<void> createTechnician(Technician technician) async {
    try {
      await _technicians.doc(technician.id).set({
        ...TechnicianModel.toFirestoreFields(technician),
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw Exception(_message(error, 'save'));
    }
  }

  @override
  Future<void> updateTechnician(Technician technician) async {
    try {
      final fields = TechnicianModel.toFirestoreFields(technician)
        ..remove('id')
        ..remove('companyId');
      await _technicians.doc(technician.id).update({
        ...fields,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw Exception(_message(error, 'update'));
    }
  }

  @override
  Future<void> deactivateTechnician(String technicianId) async {
    try {
      await _technicians.doc(technicianId).update({
        'isActive': false,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw Exception(_message(error, 'deactivate'));
    }
  }

  String _message(FirebaseException error, String action) {
    if (error.code == 'permission-denied') {
      return 'You do not have permission to $action this technician.';
    }
    return 'Could not $action the technician: ${error.message ?? error.code}';
  }

  TechnicianInvite _inviteFromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return TechnicianInvite(
      email: data['email'] as String? ?? doc.id,
      fullName: data['fullName'] as String? ?? '',
      phone: data['phone'] as String? ?? '',
      companyId: data['companyId'] as String? ?? '',
      status: data['status'] as String? ?? 'pending',
    );
  }

  @override
  Stream<List<TechnicianInvite>> watchPendingInvites(String companyId) {
    if (companyId.isEmpty) {
      return Stream.value(const []);
    }
    return _invites
        .where('companyId', isEqualTo: companyId)
        .where('status', isEqualTo: 'pending')
        .snapshots()
        .map((snapshot) => snapshot.docs.map(_inviteFromDoc).toList());
  }

  @override
  Future<void> createInvite({
    required String companyId,
    required String fullName,
    required String phone,
    required String email,
  }) async {
    final normalizedEmail = _normalizeEmail(email);
    final docRef = _invites.doc(normalizedEmail);
    try {
      final existing = await docRef.get();
      if (existing.exists) {
        final status = existing.data()?['status'];
        throw Exception(
          status == 'claimed'
              ? 'A technician has already registered with this email.'
              : 'An invitation for this email is already pending.',
        );
      }
      await docRef.set({
        'email': normalizedEmail,
        'fullName': fullName,
        'phone': phone,
        'companyId': companyId,
        'status': 'pending',
        'createdAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw Exception(_inviteMessage(error, 'create the invitation'));
    }
  }

  @override
  Future<TechnicianInvite?> fetchPendingInvite(String email) async {
    final normalizedEmail = _normalizeEmail(email);
    if (normalizedEmail.isEmpty) {
      return null;
    }
    final doc = await _invites.doc(normalizedEmail).get();
    if (!doc.exists) {
      return null;
    }
    final invite = _inviteFromDoc(doc);
    return invite.isPending ? invite : null;
  }

  @override
  Future<void> claimInvite({
    required String uid,
    required TechnicianInvite invite,
  }) async {
    final normalizedEmail = _normalizeEmail(invite.email);
    try {
      final now = FieldValue.serverTimestamp();
      final batch = _firestore.batch();
      batch.set(_firestore.collection('users').doc(uid), {
        'id': uid,
        'role': 'technician',
        'companyId': invite.companyId,
        'email': normalizedEmail,
        'fullName': invite.fullName,
        'phone': invite.phone,
        'isActive': true,
        'createdAt': now,
      });
      batch.set(_technicians.doc(uid), {
        'id': uid,
        'uid': uid,
        'companyId': invite.companyId,
        'email': normalizedEmail,
        'fullName': invite.fullName,
        'phone': invite.phone,
        'isActive': true,
        'createdAt': now,
        'updatedAt': now,
      });
      batch.update(_invites.doc(normalizedEmail), {
        'status': 'claimed',
        'claimedAt': now,
        'claimedBy': uid,
      });
      await batch.commit();
    } on FirebaseException catch (error) {
      throw Exception(_inviteMessage(error, 'claim the invitation'));
    }
  }

  String _inviteMessage(FirebaseException error, String action) {
    if (error.code == 'permission-denied') {
      return 'You do not have permission to $action.';
    }
    return 'Could not $action: ${error.message ?? error.code}';
  }
}
