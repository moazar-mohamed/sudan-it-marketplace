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

  /// Writes per batch, under Firestore's 500 with room to spare.
  static const _batchSize = 450;

  @override
  Future<void> setUsdRate(
    String companyId,
    double rate,
    Map<String, Map<String, Object?>> repricing,
  ) {
    return _guardWrite(() async {
      final entries = repricing.entries.toList();
      // The rate rides with the first products; the rest follow.
      var batch = _firestore.batch()
        ..update(_companies.doc(companyId), {
          'usdRate': rate,
          'usdRateUpdatedAt': FieldValue.serverTimestamp(),
        });
      var inBatch = 1;
      for (final entry in entries) {
        if (inBatch == _batchSize) {
          await batch.commit();
          batch = _firestore.batch();
          inBatch = 0;
        }
        batch.update(_products.doc(entry.key), _repriced(entry.value));
        inBatch++;
      }
      await batch.commit();
    });
  }

  @override
  Future<void> repriceProducts(Map<String, Map<String, Object?>> repricing) {
    return _guardWrite(() async {
      final entries = repricing.entries.toList();
      for (var start = 0; start < entries.length; start += _batchSize) {
        final batch = _firestore.batch();
        for (final entry in entries.skip(start).take(_batchSize)) {
          batch.update(_products.doc(entry.key), _repriced(entry.value));
        }
        await batch.commit();
      }
    });
  }

  CollectionReference<Map<String, dynamic>> get _products =>
      _firestore.collection('products');

  static Map<String, Object?> _repriced(Map<String, Object?> fields) => {
        ...fields,
        'updatedAt': FieldValue.serverTimestamp(),
      };

  Future<void> _guardWrite(Future<void> Function() write) async {
    try {
      await write();
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
