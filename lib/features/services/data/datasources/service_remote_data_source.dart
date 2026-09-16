import '../models/catalog_service_model.dart';

abstract class ServiceRemoteDataSource {
  Stream<List<CatalogServiceModel>> watchServices({
    required bool activeOnly,
    String? categoryId,
  });

  Future<CatalogServiceModel?> getService(String id);

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
