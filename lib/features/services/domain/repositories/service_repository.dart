import '../entities/catalog_service.dart';

abstract class ServiceRepository {
  Stream<List<CatalogService>> watchActiveServices({String? categoryId});

  Stream<List<CatalogService>> watchAllServices({String? categoryId});

  Future<CatalogService?> getService(String id);

  Future<String> createService({
    required String categoryId,
    required String name,
    required String description,
  });

  Future<void> updateService({
    required String id,
    required String categoryId,
    required String name,
    required String description,
  });

  Future<void> setServiceActive({
    required String id,
    required bool isActive,
  });
}
