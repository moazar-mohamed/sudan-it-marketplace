import '../models/category_model.dart';

abstract class CategoryRemoteDataSource {
  Stream<List<CategoryModel>> watchCategories({required bool activeOnly});

  Future<CategoryModel?> getCategory(String id);

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
