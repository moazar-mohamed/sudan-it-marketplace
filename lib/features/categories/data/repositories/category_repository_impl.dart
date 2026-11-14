import '../../domain/entities/category.dart';
import '../../domain/exceptions/category_exception.dart';
import '../../domain/repositories/category_repository.dart';
import '../datasources/category_remote_data_source.dart';

class CategoryRepositoryImpl implements CategoryRepository {
  CategoryRepositoryImpl(this._remoteDataSource);

  final CategoryRemoteDataSource _remoteDataSource;

  @override
  Stream<List<Category>> watchActiveCategories() {
    return _remoteDataSource
        .watchCategories(activeOnly: true)
        .handleError(_throwMappedError);
  }

  @override
  Stream<List<Category>> watchAllCategories() {
    return _remoteDataSource
        .watchCategories(activeOnly: false)
        .handleError(_throwMappedError);
  }

  @override
  Future<Category?> getCategory(String id) {
    return _run(() => _remoteDataSource.getCategory(id));
  }

  @override
  Future<String> createCategory({
    required String name,
    required String description,
    String iconName = '',
  }) {
    return _run(
      () => _remoteDataSource.createCategory(
        name: name,
        description: description,
        iconName: iconName,
      ),
    );
  }

  @override
  Future<void> updateCategory({
    required String id,
    required String name,
    required String description,
    String iconName = '',
  }) {
    return _run(
      () => _remoteDataSource.updateCategory(
        id: id,
        name: name,
        description: description,
        iconName: iconName,
      ),
    );
  }

  @override
  Future<void> setCategoryActive({
    required String id,
    required bool isActive,
  }) {
    return _run(
      () => _remoteDataSource.setCategoryActive(id: id, isActive: isActive),
    );
  }

  Future<T> _run<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on CategoryException {
      rethrow;
    } catch (_) {
      throw const CategoryException(
        'Could not complete the category request. Please try again.',
        code: 'unknown',
      );
    }
  }

  Never _throwMappedError(Object error, StackTrace stackTrace) {
    if (error is CategoryException) {
      throw error;
    }
    throw const CategoryException(
      'Could not load categories. Please try again.',
      code: 'unknown',
    );
  }
}
