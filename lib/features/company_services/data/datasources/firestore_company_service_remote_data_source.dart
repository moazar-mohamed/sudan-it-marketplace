import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/exceptions/company_service_exception.dart';
import '../models/company_service_model.dart';
import 'company_service_remote_data_source.dart';

class FirestoreCompanyServiceRemoteDataSource
    implements CompanyServiceRemoteDataSource {
  FirestoreCompanyServiceRemoteDataSource({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _collection = 'company_services';
  static const _servicesCollection = 'services';

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _companyServices =>
      _firestore.collection(_collection);

  @override
  Future<String> addServiceToCompany({
    required String companyId,
    required String serviceId,
    double? price,
    String? note,
  }) {
    return _run(() async {
      final resolvedCompanyId = companyId.trim();
      final resolvedServiceId = serviceId.trim();
      await _ensureCatalogServiceExists(resolvedServiceId);
      _ensureCompanyId(resolvedCompanyId);
      final resolvedPrice = _validPrice(price);
      final resolvedNote = note?.trim() ?? '';

      final existing = await _findRelationship(
        companyId: resolvedCompanyId,
        serviceId: resolvedServiceId,
      );
      if (existing != null) {
        if (existing.isActive) {
          throw const CompanyServiceException(
            'This company already offers that service.',
            code: 'already-exists',
          );
        }
        await _companyServices.doc(existing.id).update({
          'isActive': true,
          'price': resolvedPrice,
          'note': resolvedNote,
          'updatedAt': FieldValue.serverTimestamp(),
        });
        return existing.id;
      }

      // One document per company + service, so the same catalogue service
      // can never be listed twice for a company.
      final doc = _companyServices.doc(
        '${resolvedCompanyId}_$resolvedServiceId',
      );
      final model = CompanyServiceModel(
        id: doc.id,
        companyId: resolvedCompanyId,
        serviceId: resolvedServiceId,
        isActive: true,
        createdAt: DateTime.now().toUtc(),
        price: resolvedPrice,
        note: resolvedNote,
      );
      await doc.set({
        ...model.toFirestoreMap(),
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return doc.id;
    });
  }

  @override
  Future<void> updateCompanyServiceDetails({
    required String companyServiceId,
    double? price,
    String? note,
  }) {
    return _run(() async {
      await _companyServices.doc(companyServiceId.trim()).update({
        'price': _validPrice(price),
        'note': note?.trim() ?? '',
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });
  }

  @override
  Future<void> removeServiceFromCompany({
    required String companyId,
    required String serviceId,
  }) {
    return _run(() async {
      final existing = await _findRelationship(
        companyId: companyId.trim(),
        serviceId: serviceId.trim(),
      );
      if (existing == null || !existing.isActive) {
        throw const CompanyServiceException(
          'This company does not offer that service.',
          code: 'not-found',
        );
      }
      await _companyServices.doc(existing.id).update({
        'isActive': false,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });
  }

  /// A price is stored only when it is a positive number; an empty price is
  /// stored as null, never as 0.
  double? _validPrice(double? price) =>
      price != null && price > 0 ? price : null;

  @override
  Future<List<CompanyServiceModel>> getActiveServicesForCompany(
    String companyId,
  ) {
    return _run(() async {
      final snapshot = await _activeQuery().get();
      return _filterAndSort(
        snapshot.docs.map(_mapDoc),
        companyId: companyId.trim(),
      );
    });
  }

  @override
  Future<List<CompanyServiceModel>> getCompaniesOfferingService(
    String serviceId,
  ) {
    return _run(() async {
      final snapshot = await _activeQuery().get();
      return _filterAndSort(
        snapshot.docs.map(_mapDoc),
        serviceId: serviceId.trim(),
      );
    });
  }

  @override
  Stream<List<CompanyServiceModel>> watchActiveServicesForCompany(
    String companyId,
  ) {
    final resolvedCompanyId = companyId.trim();
    return _activeQuery()
        .snapshots()
        .map(
          (snapshot) => _filterAndSort(
            snapshot.docs.map(_mapDoc),
            companyId: resolvedCompanyId,
          ),
        )
        .handleError(_throwMappedError);
  }

  @override
  Stream<List<CompanyServiceModel>> watchCompaniesOfferingService(
    String serviceId,
  ) {
    final resolvedServiceId = serviceId.trim();
    return _activeQuery()
        .snapshots()
        .map(
          (snapshot) => _filterAndSort(
            snapshot.docs.map(_mapDoc),
            serviceId: resolvedServiceId,
          ),
        )
        .handleError(_throwMappedError);
  }

  Query<Map<String, dynamic>> _activeQuery() {
    return _companyServices.where('isActive', isEqualTo: true);
  }

  List<CompanyServiceModel> _filterAndSort(
    Iterable<CompanyServiceModel> items, {
    String? companyId,
    String? serviceId,
  }) {
    return items.where((item) {
        if (companyId != null && item.companyId != companyId) {
          return false;
        }
        if (serviceId != null && item.serviceId != serviceId) {
          return false;
        }
        return item.isActive;
      }).toList()
      ..sort((a, b) {
        final companyCompare = a.companyId.compareTo(b.companyId);
        if (companyCompare != 0) {
          return companyCompare;
        }
        return a.serviceId.compareTo(b.serviceId);
      });
  }

  Future<CompanyServiceModel?> _findRelationship({
    required String companyId,
    required String serviceId,
  }) async {
    if (companyId.isEmpty || serviceId.isEmpty) {
      return null;
    }
    final snapshot = await _companyServices
        .where('companyId', isEqualTo: companyId)
        .get();
    for (final doc in snapshot.docs) {
      final mapped = _mapDoc(doc);
      if (mapped.serviceId == serviceId) {
        return mapped;
      }
    }
    return null;
  }

  void _ensureCompanyId(String companyId) {
    if (companyId.isEmpty) {
      throw const CompanyServiceException(
        'Select a valid company.',
        code: 'company-not-found',
      );
    }
  }

  Future<void> _ensureCatalogServiceExists(String serviceId) async {
    if (serviceId.isEmpty) {
      throw const CompanyServiceException(
        'Select a valid service.',
        code: 'service-not-found',
      );
    }
    final snapshot = await _firestore
        .collection(_servicesCollection)
        .doc(serviceId)
        .get();
    if (!snapshot.exists) {
      throw const CompanyServiceException(
        'Select a valid service.',
        code: 'service-not-found',
      );
    }
  }

  CompanyServiceModel _mapDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    if (data == null) {
      throw const CompanyServiceException(
        'Company service data is missing.',
        code: 'invalid-data',
      );
    }
    return CompanyServiceModel.fromMap(doc.id, {
      ...data,
      'createdAt': _parseCreatedAt(data['createdAt']),
    });
  }

  DateTime _parseCreatedAt(dynamic value) {
    if (value is Timestamp) {
      return value.toDate().toUtc();
    }
    if (value is DateTime) {
      return value.toUtc();
    }
    return DateTime.now().toUtc();
  }

  Future<T> _run<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on CompanyServiceException {
      rethrow;
    } on FirebaseException catch (error) {
      throw CompanyServiceException(
        _messageForCode(error.code),
        code: error.code,
      );
    } catch (_) {
      throw const CompanyServiceException(
        'Could not update company services. Please try again.',
        code: 'unknown',
      );
    }
  }

  Never _throwMappedError(Object error, StackTrace stackTrace) {
    if (error is CompanyServiceException) {
      throw error;
    }
    if (error is FirebaseException) {
      throw CompanyServiceException(
        _messageForCode(error.code),
        code: error.code,
      );
    }
    throw const CompanyServiceException(
      'Could not load company services. Please try again.',
      code: 'unknown',
    );
  }

  String _messageForCode(String code) {
    switch (code) {
      case 'permission-denied':
        return 'You do not have permission to manage company services.';
      case 'not-found':
        return 'Company service was not found.';
      case 'unavailable':
      case 'network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return 'Could not complete the company service request. Please try again.';
    }
  }
}
