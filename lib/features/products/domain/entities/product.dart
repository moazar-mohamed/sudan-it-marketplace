class Product {
  const Product({
    required this.id,
    required this.name,
    this.price,
    this.currency = 'SDG',
    this.imageUrl,
    this.companyId,
    this.companyName,
    this.categoryId,
    this.description,
    this.inStock = true,
    this.stockCount = 10,
    this.specifications = const {},
    this.isDeliveryAvailable = true,
    this.isInstallationAvailable = false,
    this.installationPrice,
    this.offerPrice,
    this.offerEndsAt,
    this.createdAt,
  });

  final String id;
  final String name;

  /// Optional. `null` means "price on request" and is never treated as 0,
  /// because 0 is a real price.
  final double? price;
  final String currency;
  final String? imageUrl;
  final String? companyId;
  final String? companyName;

  /// References the official `categories` collection managed by Platform
  /// Admin. `null` means the product has no category yet (legacy data);
  /// existing products are never migrated automatically.
  final String? categoryId;
  final String? description;
  final bool inStock;
  final int stockCount;
  final Map<String, String> specifications;

  /// When false, customers cannot choose delivery and must use company pickup.
  final bool isDeliveryAvailable;
  final bool isInstallationAvailable;
  final double? installationPrice;

  /// The discounted price while the company runs an offer on this product.
  /// [price] stays the normal price, so the offer ends on its own at
  /// [offerEndsAt] with nothing to restore. Always below [price].
  final double? offerPrice;

  /// When the offer stops; `null` means it runs until the company ends it.
  final DateTime? offerEndsAt;
  final DateTime? createdAt;

  bool get hasPrice => price != null;

  /// An offer is running: it has a price below the normal one and has not
  /// reached its end date.
  bool get hasActiveOffer {
    final offer = offerPrice;
    final normal = price;
    if (offer == null || normal == null || offer >= normal) return false;
    final ends = offerEndsAt;
    return ends == null || DateTime.now().isBefore(ends);
  }

  /// What a customer pays for one unit right now: the offer price while an
  /// offer runs, otherwise the normal price.
  double? get salePrice => hasActiveOffer ? offerPrice : price;

  /// The offer's discount as a whole percentage, or 0 without an offer.
  int get offerDiscountPercent =>
      hasActiveOffer ? ((1 - offerPrice! / price!) * 100).round() : 0;

  /// Units remain. Products with no stock are hidden from customers (they stay
  /// visible to their company so it can restock).
  bool get hasStock => stockCount > 0;

  /// Available to buy only when marked in stock and stock remains.
  bool get isAvailable => inStock && hasStock;

  /// The most a customer may order right now: every remaining unit, or none
  /// when the product cannot be bought.
  int get maxOrderQuantity => isAvailable ? stockCount : 0;

  /// This product as it stands with [stockCount] units left.
  Product withStockCount(int stockCount) => Product(
        id: id,
        name: name,
        price: price,
        currency: currency,
        imageUrl: imageUrl,
        companyId: companyId,
        companyName: companyName,
        categoryId: categoryId,
        description: description,
        inStock: inStock,
        stockCount: stockCount,
        specifications: specifications,
        isDeliveryAvailable: isDeliveryAvailable,
        isInstallationAvailable: isInstallationAvailable,
        installationPrice: installationPrice,
        offerPrice: offerPrice,
        offerEndsAt: offerEndsAt,
        createdAt: createdAt,
      );

  /// This product with [offerPrice] until [offerEndsAt]; a `null` offer
  /// price removes the offer.
  Product withOffer(double? offerPrice, DateTime? offerEndsAt) => Product(
        id: id,
        name: name,
        price: price,
        currency: currency,
        imageUrl: imageUrl,
        companyId: companyId,
        companyName: companyName,
        categoryId: categoryId,
        description: description,
        inStock: inStock,
        stockCount: stockCount,
        specifications: specifications,
        isDeliveryAvailable: isDeliveryAvailable,
        isInstallationAvailable: isInstallationAvailable,
        installationPrice: installationPrice,
        offerPrice: offerPrice,
        offerEndsAt: offerPrice == null ? null : offerEndsAt,
        createdAt: createdAt,
      );
}
