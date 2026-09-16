import 'package:flutter_riverpod/flutter_riverpod.dart';

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
