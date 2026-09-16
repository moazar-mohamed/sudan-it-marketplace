class Category {
  const Category({
    required this.id,
    required this.name,
    required this.description,
    required this.iconName,
    required this.isActive,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String description;
  final String iconName;
  final bool isActive;
  final DateTime createdAt;
}
