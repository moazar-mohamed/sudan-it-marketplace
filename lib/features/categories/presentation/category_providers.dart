import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/datasources/category_remote_data_source.dart';
import '../data/datasources/firestore_category_remote_data_source.dart';
import '../data/repositories/category_repository_impl.dart';
import '../domain/entities/category.dart';
import '../domain/repositories/category_repository.dart';

final categoryRemoteDataSourceProvider = Provider<CategoryRemoteDataSource>((
  ref,
) {
  return FirestoreCategoryRemoteDataSource();
});

final categoryRepositoryProvider = Provider<CategoryRepository>((ref) {
  return CategoryRepositoryImpl(ref.watch(categoryRemoteDataSourceProvider));
});

final activeCategoriesProvider = StreamProvider<List<Category>>((ref) {
  return ref.watch(categoryRepositoryProvider).watchActiveCategories();
});

final allCategoriesProvider = StreamProvider<List<Category>>((ref) {
  return ref.watch(categoryRepositoryProvider).watchAllCategories();
});
