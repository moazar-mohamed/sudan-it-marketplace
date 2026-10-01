import '../../../categories/domain/category_tree.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../company_services/domain/entities/company_service.dart';
import '../../../products/domain/entities/product.dart';
import '../../../reviews/domain/review.dart';
import '../../../services/domain/entities/catalog_service.dart';
import 'home_companies_row.dart';

/// How the Companies tab is ordered.
enum CompanySort { topRated, name, mostReviewed }

/// The top-level categories each company works in, from what it sells and the
/// services it performs. Companies have no category of their own, so this is
/// what the chips filter by and the tags show. Each list follows the order
/// Platform Admin gave the categories.
Map<String, List<String>> companyTopCategories({
  required CategoryTree tree,
  required List<Product> products,
  required List<CompanyService> links,
  required List<CatalogService> services,
}) {
  final serviceCategory = {
    for (final service in services) service.id: service.categoryId,
  };
  final found = <String, Set<String>>{};

  void add(String? companyId, String? categoryId) {
    if (companyId == null || companyId.isEmpty) return;
    if (categoryId == null || !tree.isEffectivelyActive(categoryId)) return;
    final path = tree.pathOf(categoryId);
    if (path.isEmpty) return;
    found.putIfAbsent(companyId, () => <String>{}).add(path.first.id);
  }

  for (final product in products) {
    add(product.companyId, product.categoryId);
  }
  for (final link in links) {
    if (link.isActive) add(link.companyId, serviceCategory[link.serviceId]);
  }

  final order = {
    for (final (i, category) in tree.childrenOf(null).indexed) category.id: i,
  };
  return {
    for (final entry in found.entries)
      entry.key: (entry.value.toList()
        ..sort((a, b) => (order[a] ?? 1 << 30).compareTo(order[b] ?? 1 << 30))),
  };
}

/// [companies] in [categoryId] (a top-level category, or all when null),
/// ordered by [sort]. Companies that tie keep the order they came in.
List<Company> viewCompanies(
  List<Company> companies, {
  required CompanySort sort,
  required Map<String, RatingStats> ratings,
  required Map<String, List<String>> categoriesOf,
  String? categoryId,
}) {
  final kept = [
    for (final company in companies)
      if (categoryId == null ||
          (categoriesOf[company.id] ?? const <String>[]).contains(categoryId))
        company,
  ];
  switch (sort) {
    case CompanySort.topRated:
      return companiesByRating(kept, ratings);
    case CompanySort.mostReviewed:
      final indexed = [for (var i = 0; i < kept.length; i++) (i, kept[i])];
      indexed.sort((a, b) {
        final byCount = companyRating(
          b.$2,
          ratings,
        ).count.compareTo(companyRating(a.$2, ratings).count);
        return byCount != 0 ? byCount : a.$1.compareTo(b.$1);
      });
      return [for (final entry in indexed) entry.$2];
    case CompanySort.name:
      final indexed = [for (var i = 0; i < kept.length; i++) (i, kept[i])];
      indexed.sort((a, b) {
        final byName = a.$2.name.toLowerCase().compareTo(
          b.$2.name.toLowerCase(),
        );
        return byName != 0 ? byName : a.$1.compareTo(b.$1);
      });
      return [for (final entry in indexed) entry.$2];
  }
}
