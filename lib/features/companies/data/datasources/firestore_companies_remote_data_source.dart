import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/errors/app_exception.dart';
import '../../domain/entities/company.dart';
import '../../domain/entities/payment_account.dart';
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
  Future<void> updateCompanyProfile(Company company) {
    return _update(company.id, CompanyModel.toEditableFields(company));
  }

  @override
  Future<void> updatePaymentAccounts(
    String companyId,
    List<PaymentAccount> accounts,
  ) {
    return _update(companyId, {
      'paymentAccounts': CompanyModel.paymentAccountsToFirestore(accounts),
    });
  }

  Future<void> _update(String companyId, Map<String, dynamic> fields) async {
    try {
      await _companies.doc(companyId).update({
        ...fields,
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
