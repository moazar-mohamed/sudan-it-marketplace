import '../../../categories/domain/category_tree.dart';
import '../../../products/domain/entities/product.dart';
import 'home_service_view.dart';

/// How many products and services sit in a category and everything below it.
class CategoryCount {
  const CategoryCount({this.products = 0, this.services = 0});

  final int products;
  final int services;

  int get total => products + services;
  bool get isEmpty => total == 0;
}

/// The count of every category of [tree]: an item filed in a category also
/// counts in each category above it, so a parent shows everything under it.
/// Items with no category, or a category that is not in [tree], count nowhere.
Map<String, CategoryCount> countByCategory({
  required CategoryTree tree,
  required Iterable<String?> productCategoryIds,
  required Iterable<String?> serviceCategoryIds,
}) {
  final products = <String, int>{};
  final services = <String, int>{};
  void add(Map<String, int> into, String? id) {
    if (id == null || !tree.contains(id)) return;
    for (final category in tree.pathOf(id)) {
      into[category.id] = (into[category.id] ?? 0) + 1;
    }
  }

  for (final id in productCategoryIds) {
    add(products, id);
  }
  for (final id in serviceCategoryIds) {
    add(services, id);
  }
  return {
    for (final id in {...products.keys, ...services.keys})
      id: CategoryCount(
        products: products[id] ?? 0,
        services: services[id] ?? 0,
      ),
  };
}

/// Which kind of thing a category screen lists.
enum BrowseKind { all, products, services }

/// What narrows a category screen's list. Brand and "in stock" only exist for
/// products, so choosing either leaves the services out.
class BrowseFilters {
  const BrowseFilters({
    this.kind = BrowseKind.all,
    this.offers = false,
    this.inStock = false,
    this.brand,
    this.companyId,
    this.minPrice,
    this.maxPrice,
  });

  final BrowseKind kind;
  final bool offers;
  final bool inStock;
  final String? brand;
  final String? companyId;
  final double? minPrice;
  final double? maxPrice;

  bool get hasPrice => minPrice != null || maxPrice != null;

  /// Whether anything but the kind narrows the list.
  bool get isActive =>
      offers || inStock || brand != null || companyId != null || hasPrice;

  bool get showsProducts => kind != BrowseKind.services;

  /// Services have no brand and no stock, so those filters hide them.
  bool get showsServices =>
      kind != BrowseKind.products && !inStock && brand == null;

  BrowseFilters copyWith({
    BrowseKind? kind,
    bool? offers,
    bool? inStock,
    String? brand,
    bool clearBrand = false,
    String? companyId,
    bool clearCompany = false,
    double? minPrice,
    double? maxPrice,
  }) => BrowseFilters(
    kind: kind ?? this.kind,
    offers: offers ?? this.offers,
    inStock: inStock ?? this.inStock,
    brand: clearBrand ? null : (brand ?? this.brand),
    companyId: clearCompany ? null : (companyId ?? this.companyId),
    minPrice: minPrice ?? this.minPrice,
    maxPrice: maxPrice ?? this.maxPrice,
  );

  /// The same filters with the price range replaced (null = open on that side).
  BrowseFilters withPrice(double? min, double? max) => BrowseFilters(
    kind: kind,
    offers: offers,
    inStock: inStock,
    brand: brand,
    companyId: companyId,
    minPrice: min,
    maxPrice: max,
  );

  /// The same kind, with every other filter cleared.
  BrowseFilters cleared() => BrowseFilters(kind: kind);
}

bool _priceWithin(double? price, BrowseFilters filters) {
  if (!filters.hasPrice) return true;
  if (price == null) return false;
  final min = filters.minPrice;
  final max = filters.maxPrice;
  return (min == null || price >= min) && (max == null || price <= max);
}

String _brandKey(String brand) => brand.trim().toLowerCase();

/// [products] kept by [filters] (the order is unchanged).
List<Product> filterProducts(List<Product> products, BrowseFilters filters) {
  if (!filters.showsProducts) return const [];
  final brand = filters.brand == null ? null : _brandKey(filters.brand!);
  return [
    for (final product in products)
      if ((!filters.offers || product.hasActiveOffer) &&
          (!filters.inStock || product.isAvailable) &&
          (brand == null || _brandKey(product.brand) == brand) &&
          (filters.companyId == null ||
              product.companyId == filters.companyId) &&
          _priceWithin(product.salePrice, filters))
        product,
  ];
}

/// [listings] kept by [filters] (the order is unchanged).
List<ServiceListing> filterListings(
  List<ServiceListing> listings,
  BrowseFilters filters,
) {
  if (!filters.showsServices) return const [];
  return [
    for (final listing in listings)
      if ((!filters.offers || listing.bestDiscount > 0) &&
          (filters.companyId == null ||
              listing.offers.any((o) => o.companyId == filters.companyId)) &&
          _priceWithin(listing.startsFrom, filters))
        listing,
  ];
}

/// The brands of [products], each once (spelled as first met), A to Z.
List<String> brandsOf(Iterable<Product> products) {
  final byKey = <String, String>{};
  for (final product in products) {
    final brand = product.brand.trim();
    if (brand.isNotEmpty) byKey.putIfAbsent(_brandKey(brand), () => brand);
  }
  return byKey.values.toList()
    ..sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
}
