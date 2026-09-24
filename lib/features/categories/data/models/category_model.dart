import '../../domain/entities/category.dart';

class CategoryModel extends Category {
  const CategoryModel({
    required super.id,
    required super.name,
    required super.description,
    required super.iconName,
    required super.isActive,
    required super.createdAt,
    super.nameAr,
    super.nameEn,
    super.sortOrder,
  });

  factory CategoryModel.fromMap(String id, Map<String, dynamic> data) {
    return CategoryModel(
      id: id,
      name: data['name'] as String? ?? '',
      nameAr: data['nameAr'] as String? ?? '',
      nameEn: data['nameEn'] as String? ?? '',
      sortOrder: (data['sortOrder'] as num?)?.toInt(),
      description: data['description'] as String? ?? '',
      iconName: data['iconName'] as String? ?? '',
      isActive: data['isActive'] as bool? ?? false,
      createdAt: data['createdAt'] is DateTime
          ? (data['createdAt'] as DateTime).toUtc()
          : DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toFirestoreMap() {
    return {
      'id': id,
      'name': name,
      if (nameAr.isNotEmpty) 'nameAr': nameAr,
      if (nameEn.isNotEmpty) 'nameEn': nameEn,
      if (sortOrder != null) 'sortOrder': sortOrder,
      'description': description,
      'iconName': iconName,
      'isActive': isActive,
    };
  }
}
