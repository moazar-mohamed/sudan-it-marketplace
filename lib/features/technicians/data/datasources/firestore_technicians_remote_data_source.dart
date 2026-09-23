import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import '../../domain/entities/technician.dart';
import '../models/technician_model.dart';
import 'technicians_remote_data_source.dart';
import '../../../../core/errors/app_exception.dart';

class FirestoreTechniciansRemoteDataSource
    implements TechniciansRemoteDataSource {
  FirestoreTechniciansRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _techniciansCollection = 'technicians';
  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _technicians =>
      _firestore.collection(_techniciansCollection);

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
      throw _failure(error, AppErrorCode.technicianUpdateDenied, AppErrorCode.technicianUpdateFailed);
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
      throw _failure(error, AppErrorCode.technicianDeactivateDenied, AppErrorCode.technicianDeactivateFailed);
    }
  }

  /// Name of the throw-away Firebase app that creates technician accounts.
  static const _provisioningAppName = 'technician-provisioning';

  /// A second app instance, so creating the technician's Auth account never
  /// signs the technician in on (or signs the company admin out of) the main
  /// session: createUserWithEmailAndPassword signs the new user in on
  /// whichever Auth instance it is called on.
  Future<FirebaseApp> _provisioningApp() async {
    try {
      return Firebase.app(_provisioningAppName);
    } on FirebaseException {
      return Firebase.initializeApp(
        name: _provisioningAppName,
        options: Firebase.app().options,
      );
    }
  }

  @override
  Future<void> provisionTechnician({
    required String companyId,
    required String fullName,
    required String phone,
    required String email,
    required String password,
  }) async {
    final normalizedEmail = _normalizeEmail(email);
    final app = await _provisioningApp();
    final auth = FirebaseAuth.instanceFor(app: app);
    try {
      final created = (await auth.createUserWithEmailAndPassword(
        email: normalizedEmail,
        password: password,
      ))
          .user;
      if (created == null) {
        throw const AppException(AppErrorCode.technicianSaveFailed);
      }
      final uid = created.uid;

      // The profile and the technician record are written together by the
      // company admin's own session, so either both exist or neither does.
      final now = FieldValue.serverTimestamp();
      final batch = _firestore.batch();
      batch.set(_firestore.collection('users').doc(uid), {
        'id': uid,
        'role': 'technician',
        'companyId': companyId,
        'email': normalizedEmail,
        'fullName': fullName,
        'phone': phone,
        'isActive': true,
        'mustChangePassword': true,
        'createdAt': now,
      });
      batch.set(_technicians.doc(uid), {
        'id': uid,
        'uid': uid,
        'companyId': companyId,
        'email': normalizedEmail,
        'fullName': fullName,
        'phone': phone,
        'isActive': true,
        'createdAt': now,
        'updatedAt': now,
      });
      try {
        await batch.commit();
      } catch (_) {
        // Do not leave a login without a profile behind.
        await _discard(created);
        rethrow;
      }
    } on AppException {
      rethrow;
    } on FirebaseAuthException catch (error) {
      if (error.code == 'email-already-in-use') {
        throw const AppException(AppErrorCode.technicianEmailInUse);
      }
      throw AppException(
        AppErrorCode.technicianSaveFailed,
        detail: '${error.code}: ${error.message}',
      );
    } on FirebaseException catch (error) {
      throw _failure(
        error,
        AppErrorCode.technicianSaveDenied,
        AppErrorCode.technicianSaveFailed,
      );
    } finally {
      try {
        await auth.signOut();
        await app.delete();
      } catch (_) {}
    }
  }

  Future<void> _discard(User user) async {
    try {
      await user.delete();
    } catch (_) {}
  }

  AppException _failure(
    FirebaseException error,
    AppErrorCode denied,
    AppErrorCode failed,
  ) {
    if (error.code == 'permission-denied') {
      return AppException(denied);
    }
    return AppException(failed, detail: '${error.code}: ${error.message}');
  }
}
