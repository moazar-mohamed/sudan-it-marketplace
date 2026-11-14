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

  /// The active companies, the only ones customers may read: the rules refuse
  /// a list that could include a pending, rejected or deactivated company.
  @override
  Stream<List<Company>> watchAllCompanies() {
    return _companies.where('status', isEqualTo: 'active').snapshots().map(
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

  /// The public profile, and the email in company_private with it (one
  /// batch). An empty email is never written: the email is the admin's login.
  @override
  Future<void> updateCompanyProfile(Company company) {
    return _guardWrite(() {
      final email = (company.email ?? '').trim();
      final batch = _firestore.batch()
        ..update(_companies.doc(company.id), {
          ...CompanyModel.toEditableFields(company),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      if (email.isNotEmpty) {
        batch.set(_firestore.collection('company_private').doc(company.id), {
          'companyId': company.id,
          'email': email,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
      return batch.commit();
    });
  }

  /// In their own document: everyone reads the company document, visitors
  /// too, while only signed-in customers may read the accounts.
  @override
  Future<void> updatePaymentAccounts(
    String companyId,
    List<PaymentAccount> accounts,
  ) {
    return _guardWrite(
      () => _firestore.collection('company_payment').doc(companyId).set({
        'companyId': companyId,
        'paymentAccounts': CompanyModel.paymentAccountsToFirestore(accounts),
        'updatedAt': FieldValue.serverTimestamp(),
      }),
    );
  }

  @override
  Stream<List<PaymentAccount>> watchPaymentAccounts(String companyId) {
    return _firestore
        .collection('company_payment')
        .doc(companyId)
        .snapshots()
        .map(
          (doc) => CompanyModel.paymentAccountsFromFirestore(
            doc.data()?['paymentAccounts'],
          ),
        );
  }

  @override
  Stream<String?> watchCompanyEmail(String companyId) {
    return _firestore
        .collection('company_private')
        .doc(companyId)
        .snapshots()
        .map((doc) {
          final email = doc.data()?['email'];
          return email is String ? email : null;
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
}
