import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/technician.dart';
import '../models/technician_model.dart';
import 'technicians_remote_data_source.dart';

class FirestoreTechniciansRemoteDataSource
    implements TechniciansRemoteDataSource {
  FirestoreTechniciansRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _techniciansCollection = 'technicians';
  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _technicians =>
      _firestore.collection(_techniciansCollection);

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
}
