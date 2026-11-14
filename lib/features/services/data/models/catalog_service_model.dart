import '../../domain/entities/catalog_service.dart';

class CatalogServiceModel extends CatalogService {
  const CatalogServiceModel({
    required super.id,
    required super.categoryId,
    required super.name,
    required super.description,
    required super.isActive,
    required super.createdAt,
    super.ownerCompanyId,
  });

  factory CatalogServiceModel.fromMap(String id, Map<String, dynamic> data) {
    return CatalogServiceModel(
      id: id,
      categoryId: data['categoryId'] as String? ?? '',
      name: data['name'] as String? ?? '',
      description: data['description'] as String? ?? '',
      isActive: data['isActive'] as bool? ?? false,
      ownerCompanyId: data['ownerCompanyId'] as String?,
      createdAt: data['createdAt'] is DateTime
          ? (data['createdAt'] as DateTime).toUtc()
          : DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toFirestoreMap() {
    return {
      'id': id,
      'categoryId': categoryId,
      'name': name,
      'description': description,
      'isActive': isActive,
      if (ownerCompanyId != null) 'ownerCompanyId': ownerCompanyId,
    };
  }
}
