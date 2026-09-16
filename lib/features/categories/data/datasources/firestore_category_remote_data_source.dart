import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/exceptions/category_exception.dart';
import '../models/category_model.dart';
import 'category_remote_data_source.dart';

class FirestoreCategoryRemoteDataSource implements CategoryRemoteDataSource {
  FirestoreCategoryRemoteDataSource({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _collection = 'categories';

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _categories =>
      _firestore.collection(_collection);

  @override
  Stream<List<CategoryModel>> watchCategories({required bool activeOnly}) {
    Query<Map<String, dynamic>> query = _categories;
    if (activeOnly) {
      query = query.where('isActive', isEqualTo: true);
    }

    return query
        .snapshots()
        .map((snapshot) {
          final categories = snapshot.docs.map(_mapDoc).toList()
            ..sort(
              (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
            );
          return categories;
        })
        .handleError(_throwMappedError);
  }

  @override
  Future<CategoryModel?> getCategory(String id) {
    return _run(() async {
      final snapshot = await _categories.doc(id).get();
      if (!snapshot.exists || snapshot.data() == null) {
        return null;
      }
      return _mapDoc(snapshot);
    });
  }

  @override
  Future<String> createCategory({
    required String name,
    required String description,
    String iconName = '',
  }) {
    return _run(() async {
      final doc = _categories.doc();
      final model = CategoryModel(
        id: doc.id,
        name: name.trim(),
        description: description.trim(),
        iconName: iconName.trim(),
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
  Future<void> updateCategory({
    required String id,
    required String name,
    required String description,
    String iconName = '',
  }) {
    return _run(() async {
      await _categories.doc(id).update({
        'name': name.trim(),
        'description': description.trim(),
        'iconName': iconName.trim(),
      });
    });
  }

  @override
  Future<void> setCategoryActive({
    required String id,
    required bool isActive,
  }) {
    return _run(() async {
      await _categories.doc(id).update({'isActive': isActive});
    });
  }

  CategoryModel _mapDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    if (data == null) {
      throw const CategoryException(
        'Category data is missing.',
        code: 'invalid-data',
      );
    }
    return CategoryModel.fromMap(doc.id, {
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
    } on CategoryException {
      rethrow;
    } on FirebaseException catch (error) {
      throw CategoryException(_messageForCode(error.code), code: error.code);
    } catch (_) {
      throw const CategoryException(
        'Could not load categories. Please try again.',
        code: 'unknown',
      );
    }
  }

  Never _throwMappedError(Object error, StackTrace stackTrace) {
    if (error is CategoryException) {
      throw error;
    }
    if (error is FirebaseException) {
      throw CategoryException(_messageForCode(error.code), code: error.code);
    }
    throw const CategoryException(
      'Could not load categories. Please try again.',
      code: 'unknown',
    );
  }

  String _messageForCode(String code) {
    switch (code) {
      case 'permission-denied':
        return 'You do not have permission to manage categories.';
      case 'not-found':
        return 'Category was not found.';
      case 'unavailable':
      case 'network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return 'Could not complete the category request. Please try again.';
    }
  }
}
