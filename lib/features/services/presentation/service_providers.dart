import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../categories/domain/entities/category.dart';
import '../../categories/presentation/category_providers.dart';
import '../data/datasources/firestore_service_remote_data_source.dart';
import '../data/datasources/service_remote_data_source.dart';
import '../data/repositories/service_repository_impl.dart';
import '../domain/entities/catalog_service.dart';
import '../domain/repositories/service_repository.dart';

final serviceRemoteDataSourceProvider = Provider<ServiceRemoteDataSource>((
  ref,
) {
  return FirestoreServiceRemoteDataSource();
});

final serviceRepositoryProvider = Provider<ServiceRepository>((ref) {
  return ServiceRepositoryImpl(ref.watch(serviceRemoteDataSourceProvider));
});

final activeServicesProvider = StreamProvider.family<List<CatalogService>, String?>(
  (ref, categoryId) {
    return ref
        .watch(serviceRepositoryProvider)
        .watchActiveServices(categoryId: categoryId);
  },
);

final allServicesProvider = StreamProvider.family<List<CatalogService>, String?>(
  (ref, categoryId) {
    return ref
        .watch(serviceRepositoryProvider)
        .watchAllServices(categoryId: categoryId);
  },
);

/// Catalogue services customers can browse: active services, minus those of
/// a category the Platform Admin has deactivated.
final marketplaceServicesProvider =
    Provider<AsyncValue<List<CatalogService>>>((ref) {
  final services = ref.watch(activeServicesProvider(null));
  final categories = ref.watch(allCategoriesProvider).asData?.value ??
      const <Category>[];
  final inactiveCategoryIds = {
    for (final category in categories)
      if (!category.isActive) category.id,
  };
  return services.whenData(
    (list) => list
        .where((service) => !inactiveCategoryIds.contains(service.categoryId))
        .toList(),
  );
});
