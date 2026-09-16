import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/exceptions/service_exception.dart';
import '../models/catalog_service_model.dart';
import 'service_remote_data_source.dart';

class FirestoreServiceRemoteDataSource implements ServiceRemoteDataSource {
  FirestoreServiceRemoteDataSource({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _servicesCollection = 'services';
  static const _categoriesCollection = 'categories';

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _services =>
      _firestore.collection(_servicesCollection);

  @override
  Stream<List<CatalogServiceModel>> watchServices({
    required bool activeOnly,
    String? categoryId,
  }) {
    Query<Map<String, dynamic>> query = _services;
    final trimmedCategoryId = categoryId?.trim();

    if (trimmedCategoryId != null && trimmedCategoryId.isNotEmpty) {
      query = query.where('categoryId', isEqualTo: trimmedCategoryId);
    } else if (activeOnly) {
      query = query.where('isActive', isEqualTo: true);
    }

    return query
        .snapshots()
        .map((snapshot) {
          final services = snapshot.docs.map(_mapDoc).where((service) {
            if (!activeOnly) {
              return true;
            }
            return service.isActive;
          }).toList()
            ..sort(
              (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
            );
          return services;
        })
        .handleError(_throwMappedError);
  }

  @override
  Future<CatalogServiceModel?> getService(String id) {
    return _run(() async {
      final snapshot = await _services.doc(id).get();
      if (!snapshot.exists || snapshot.data() == null) {
        return null;
      }
      return _mapDoc(snapshot);
    });
  }

  @override
  Future<String> createService({
    required String categoryId,
    required String name,
    required String description,
  }) {
    return _run(() async {
      final resolvedCategoryId = categoryId.trim();
      await _ensureCategoryExists(resolvedCategoryId);

      final doc = _services.doc();
      final model = CatalogServiceModel(
        id: doc.id,
        categoryId: resolvedCategoryId,
        name: name.trim(),
        description: description.trim(),
        isActive: true,
        createdAt: DateTime.now().toUtc(),
      );
      await doc.set({
        ...model.toFirestoreMap(),
        'createdAt': FieldValue.serverTimestamp(),
      });
      return doc.id;
    });
  }

  @override
  Future<void> updateService({
    required String id,
    required String categoryId,
    required String name,
    required String description,
  }) {
    return _run(() async {
      final resolvedCategoryId = categoryId.trim();
      await _ensureCategoryExists(resolvedCategoryId);
      await _services.doc(id).update({
        'categoryId': resolvedCategoryId,
        'name': name.trim(),
        'description': description.trim(),
      });
    });
  }

  @override
  Future<void> setServiceActive({
    required String id,
    required bool isActive,
  }) {
    return _run(() async {
      await _services.doc(id).update({'isActive': isActive});
    });
  }

  Future<void> _ensureCategoryExists(String categoryId) async {
    if (categoryId.isEmpty) {
      throw const ServiceException(
        'Select a valid category.',
        code: 'category-not-found',
      );
    }
    final snapshot = await _firestore
        .collection(_categoriesCollection)
        .doc(categoryId)
        .get();
    if (!snapshot.exists) {
      throw const ServiceException(
        'Select a valid category.',
        code: 'category-not-found',
      );
    }
  }

  CatalogServiceModel _mapDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    if (data == null) {
      throw const ServiceException(
        'Service data is missing.',
        code: 'invalid-data',
      );
    }
    return CatalogServiceModel.fromMap(doc.id, {
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
    } on ServiceException {
      rethrow;
    } on FirebaseException catch (error) {
      throw ServiceException(_messageForCode(error.code), code: error.code);
    } catch (_) {
      throw const ServiceException(
        'Could not load services. Please try again.',
        code: 'unknown',
      );
    }
  }

  Never _throwMappedError(Object error, StackTrace stackTrace) {
    if (error is ServiceException) {
      throw error;
    }
    if (error is FirebaseException) {
      throw ServiceException(_messageForCode(error.code), code: error.code);
    }
    throw const ServiceException(
      'Could not load services. Please try again.',
      code: 'unknown',
    );
  }

  String _messageForCode(String code) {
    switch (code) {
      case 'permission-denied':
        return 'You do not have permission to manage services.';
      case 'not-found':
        return 'Service was not found.';
      case 'unavailable':
      case 'network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return 'Could not complete the service request. Please try again.';
    }
  }
}
