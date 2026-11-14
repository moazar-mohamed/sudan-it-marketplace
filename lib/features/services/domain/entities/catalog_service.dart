class CatalogService {
  const CatalogService({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.description,
    required this.isActive,
    required this.createdAt,
    this.ownerCompanyId,
  });

  final String id;
  final String categoryId;
  final String name;
  final String description;
  final bool isActive;
  final DateTime createdAt;

  /// The company that created this service itself; `null` for a Platform
  /// Admin catalogue service.
  final String? ownerCompanyId;

  bool get isCompanyOwned => ownerCompanyId != null;
}
