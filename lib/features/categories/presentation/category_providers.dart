import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/locale_controller.dart';
import '../data/datasources/category_remote_data_source.dart';
import '../data/datasources/firestore_category_remote_data_source.dart';
import '../data/repositories/category_repository_impl.dart';
import '../domain/category_tree.dart';
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

/// Every category by id (inactive ones included), for looking one up.
final categoriesByIdProvider = Provider<Map<String, Category>>((ref) {
  final categories =
      ref.watch(allCategoriesProvider).asData?.value ?? const <Category>[];
  return {for (final category in categories) category.id: category};
});

/// Category names by id in the language the app is showing, for labelling
/// products and services.
final categoryNamesProvider = Provider<Map<String, String>>((ref) {
  final language = ref.watch(localeControllerProvider).languageCode;
  final categories = ref.watch(categoriesByIdProvider);
  return {
    for (final category in categories.values)
      category.id: category.nameFor(language),
  };
});

/// The one tree of categories products and services are both filed in.
/// Follows Platform Admin's changes live: nothing is stored in the app.
final categoryTreeProvider = Provider<CategoryTree>((ref) {
  final categories =
      ref.watch(allCategoriesProvider).asData?.value ?? const <Category>[];
  return CategoryTree(categories);
});

/// Full paths ("Networking › Routers") by category id, in the language the app
/// is showing, for labelling a product or service unambiguously.
final categoryPathNamesProvider = Provider<Map<String, String>>((ref) {
  final language = ref.watch(localeControllerProvider).languageCode;
  final categories =
      ref.watch(allCategoriesProvider).asData?.value ?? const <Category>[];
  final tree = CategoryTree(categories);
  return {
    for (final category in categories)
      category.id: tree.pathLabel(category.id, language),
  };
});
