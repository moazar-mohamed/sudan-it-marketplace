import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/errors/app_exception.dart';
import '../../domain/entities/company.dart';
import '../models/company_model.dart';
import 'companies_remote_data_source.dart';

class FirestoreCompaniesRemoteDataSource implements CompaniesRemoteDataSource {
  FirestoreCompaniesRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _companiesCollection = 'companies';
  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _companies =>
      _firestore.collection(_companiesCollection);

  @override
  Stream<List<Company>> watchAllCompanies() {
    return _companies.snapshots().map(
          (snapshot) =>
              snapshot.docs.map(CompanyModel.fromFirestore).toList(),
        );
  }

  @override
  Stream<Company?> watchCompany(String companyId) {
    return _companies.doc(companyId).snapshots().map(
          (doc) => doc.exists ? CompanyModel.fromFirestore(doc) : null,
        );
  }

  @override
  Future<void> updateCompanyProfile(Company company) async {
    try {
      await _companies.doc(company.id).update({
        ...CompanyModel.toEditableFields(company),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      if (error.code == 'permission-denied') {
        throw const AppException(AppErrorCode.companyUpdateDenied);
      }
      throw AppException(
        AppErrorCode.companyUpdateFailed,
        detail: '${error.code}: ${error.message}',
      );
    }
  }
}
