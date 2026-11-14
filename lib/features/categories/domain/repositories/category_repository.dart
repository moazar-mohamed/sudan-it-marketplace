import '../entities/category.dart';

abstract class CategoryRepository {
  Stream<List<Category>> watchActiveCategories();

  Stream<List<Category>> watchAllCategories();

  Future<Category?> getCategory(String id);

  Future<String> createCategory({
    required String name,
    required String description,
    String iconName = '',
  });

  Future<void> updateCategory({
    required String id,
    required String name,
    required String description,
    String iconName = '',
  });

  Future<void> setCategoryActive({
    required String id,
    required bool isActive,
  });
}
