class Category {
  const Category({
    required this.id,
    required this.name,
    required this.description,
    required this.iconName,
    required this.isActive,
    required this.createdAt,
    this.nameAr = '',
    this.nameEn = '',
    this.sortOrder,
  });

  final String id;

  /// The name kept for every language; also what older categories only have.
  final String name;

  /// The name shown to Arabic and English users. Empty on categories created
  /// before names had two languages; [name] is used then.
  final String nameAr;
  final String nameEn;
  final String description;
  final String iconName;
  final bool isActive;
  final DateTime createdAt;

  /// Position in the customer's category list, set by Platform Admin. Categories
  /// without one come after those with one.
  final int? sortOrder;

  /// The name to show for [languageCode] ('ar' or 'en'), falling back to
  /// [name] when that language has none.
  String nameFor(String languageCode) {
    final localized = (languageCode == 'ar' ? nameAr : nameEn).trim();
    return localized.isNotEmpty ? localized : name;
  }

  /// Every spelling of the name, so a search in either language finds it.
  String get searchText => '$name $nameAr $nameEn';
}

/// Platform Admin's order first, then the rest by name.
int compareCategories(Category a, Category b) {
  final orderA = a.sortOrder;
  final orderB = b.sortOrder;
  if (orderA != null && orderB != null && orderA != orderB) {
    return orderA.compareTo(orderB);
  }
  if (orderA != null && orderB == null) return -1;
  if (orderA == null && orderB != null) return 1;
  return a.name.toLowerCase().compareTo(b.name.toLowerCase());
}
