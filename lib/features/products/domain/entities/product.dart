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
  final DateTime? createdAt;

  bool get hasPrice => price != null;

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
        createdAt: createdAt,
      );
}
