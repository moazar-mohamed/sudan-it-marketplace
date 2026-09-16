class CatalogService {
  const CatalogService({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.description,
    required this.isActive,
    required this.createdAt,
  });

  final String id;
  final String categoryId;
  final String name;
  final String description;
  final bool isActive;
  final DateTime createdAt;
}
