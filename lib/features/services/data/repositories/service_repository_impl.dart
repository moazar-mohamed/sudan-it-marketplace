import '../../domain/entities/catalog_service.dart';
import '../../domain/exceptions/service_exception.dart';
import '../../domain/repositories/service_repository.dart';
import '../datasources/service_remote_data_source.dart';

class ServiceRepositoryImpl implements ServiceRepository {
  ServiceRepositoryImpl(this._remoteDataSource);

  final ServiceRemoteDataSource _remoteDataSource;

  @override
  Stream<List<CatalogService>> watchActiveServices({String? categoryId}) {
    return _remoteDataSource
        .watchServices(activeOnly: true, categoryId: categoryId)
        .handleError(_throwMappedError);
  }

  @override
  Stream<List<CatalogService>> watchAllServices({String? categoryId}) {
    return _remoteDataSource
        .watchServices(activeOnly: false, categoryId: categoryId)
        .handleError(_throwMappedError);
  }

  @override
  Future<CatalogService?> getService(String id) {
    return _run(() => _remoteDataSource.getService(id));
  }

  @override
  Future<String> createService({
    required String categoryId,
    required String name,
    required String description,
    String? ownerCompanyId,
  }) {
    return _run(
      () => _remoteDataSource.createService(
        categoryId: categoryId,
        name: name,
        description: description,
        ownerCompanyId: ownerCompanyId,
      ),
    );
  }

  @override
  Future<void> updateService({
    required String id,
    required String categoryId,
    required String name,
    required String description,
  }) {
    return _run(
      () => _remoteDataSource.updateService(
        id: id,
        categoryId: categoryId,
        name: name,
        description: description,
      ),
    );
  }

  @override
  Future<void> setServiceActive({
    required String id,
    required bool isActive,
  }) {
    return _run(
      () => _remoteDataSource.setServiceActive(id: id, isActive: isActive),
    );
  }

  Future<T> _run<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on ServiceException {
      rethrow;
    } catch (_) {
      throw const ServiceException(
        'Could not complete the service request. Please try again.',
        code: 'unknown',
      );
    }
  }

  Never _throwMappedError(Object error, StackTrace stackTrace) {
    if (error is ServiceException) {
      throw error;
    }
    throw const ServiceException(
      'Could not load services. Please try again.',
      code: 'unknown',
    );
  }
}
