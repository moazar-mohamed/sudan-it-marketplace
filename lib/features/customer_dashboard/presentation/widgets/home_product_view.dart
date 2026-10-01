import '../../../products/domain/entities/product.dart';
import '../../../reviews/domain/review.dart';

/// How the home's "All products" list is ordered.
enum ProductSort { newest, priceLow, priceHigh, topRated }

/// The filter chips above the list; each one narrows it further.
class ProductFilters {
  const ProductFilters({
    this.offers = false,
    this.delivery = false,
    this.installation = false,
    this.topRated = false,
  });

  final bool offers;
  final bool delivery;
  final bool installation;
  final bool topRated;

  bool get isActive => offers || delivery || installation || topRated;

  ProductFilters copyWith({
    bool? offers,
    bool? delivery,
    bool? installation,
    bool? topRated,
  }) => ProductFilters(
    offers: offers ?? this.offers,
    delivery: delivery ?? this.delivery,
    installation: installation ?? this.installation,
    topRated: topRated ?? this.topRated,
  );
}

/// A product counts as "top rated" from this average (it needs a rating).
const topRatedFrom = 4.0;

/// A product is "new" for this long after it was added.
const newProductFor = Duration(days: 14);

/// Products added within this long are listed under "Recently added".
const recentProductFor = Duration(days: 30);

/// [products] narrowed by [filters] and ordered by [sort]. [ratings] are the
/// live averages, keyed as in [RatingStats.productKey]. Products that tie keep
/// the order they came in.
List<Product> viewProducts(
  List<Product> products, {
  required ProductSort sort,
  required ProductFilters filters,
  Map<String, RatingStats> ratings = const {},
}) {
  RatingStats? statsOf(Product p) => ratings[RatingStats.productKey(p.id)];
  double averageOf(Product p) => statsOf(p)?.average ?? 0;
  bool isTopRated(Product p) {
    final stats = statsOf(p);
    return stats != null && stats.hasRatings && stats.average >= topRatedFrom;
  }

  final kept = <(int, Product)>[
    for (var i = 0; i < products.length; i++)
      if ((!filters.offers || products[i].hasActiveOffer) &&
          (!filters.delivery || products[i].isDeliveryAvailable) &&
          (!filters.installation || products[i].isInstallationAvailable) &&
          (!filters.topRated || isTopRated(products[i])))
        (i, products[i]),
  ];

  // Something without the thing being sorted on goes last, whichever way.
  int byPrice(Product a, Product b, {required bool descending}) {
    final pa = a.salePrice;
    final pb = b.salePrice;
    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;
    return descending ? pb.compareTo(pa) : pa.compareTo(pb);
  }

  int compare((int, Product) a, (int, Product) b) {
    final result = switch (sort) {
      ProductSort.newest => _byNewest(a.$2, b.$2),
      ProductSort.priceLow => byPrice(a.$2, b.$2, descending: false),
      ProductSort.priceHigh => byPrice(a.$2, b.$2, descending: true),
      ProductSort.topRated => () {
        final byAverage = averageOf(b.$2).compareTo(averageOf(a.$2));
        if (byAverage != 0) return byAverage;
        return (statsOf(b.$2)?.count ?? 0).compareTo(statsOf(a.$2)?.count ?? 0);
      }(),
    };
    return result != 0 ? result : a.$1.compareTo(b.$1);
  }

  return [for (final entry in (kept..sort(compare))) entry.$2];
}

int _byNewest(Product a, Product b) {
  final da = a.createdAt;
  final db = b.createdAt;
  if (da == null && db == null) return 0;
  if (da == null) return 1;
  if (db == null) return -1;
  return db.compareTo(da);
}

/// Whether [product] was added in the last [newProductFor].
bool isNewProduct(Product product, DateTime now) {
  final added = product.createdAt;
  return added != null && now.difference(added) <= newProductFor;
}

/// The latest products, newest first: those added in the last
/// [recentProductFor], at most [limit].
List<Product> recentProducts(
  List<Product> products,
  DateTime now, {
  int limit = 8,
}) {
  final recent = [
    for (final p in products)
      if (p.createdAt != null &&
          now.difference(p.createdAt!) <= recentProductFor)
        p,
  ]..sort(_byNewest);
  return recent.take(limit).toList();
}
