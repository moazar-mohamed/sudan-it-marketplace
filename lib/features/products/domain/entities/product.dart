class Product {
  const Product({
    required this.id,
    required this.name,
    required this.price,
    this.currency = 'SDG',
    this.imageUrl,
    this.companyId,
    this.companyName,
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
  final double price;
  final String currency;
  final String? imageUrl;
  final String? companyId;
  final String? companyName;
  final String? description;
  final bool inStock;
  final int stockCount;
  final Map<String, String> specifications;

  /// When false, customers cannot choose delivery and must use company pickup.
  final bool isDeliveryAvailable;
  final bool isInstallationAvailable;
  final double? installationPrice;
  final DateTime? createdAt;

  /// Available to buy only when marked in stock and stock remains.
  bool get isAvailable => inStock && stockCount > 0;
}
