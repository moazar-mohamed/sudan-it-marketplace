import '../../../offers/domain/offer_pricing.dart';

class Product with OfferPricing {
  const Product({
    required this.id,
    required this.name,
    this.price,
    this.currency = 'SDG',
    this.imageUrl,
    this.imageUrls = const [],
    this.companyId,
    this.companyName,
    this.categoryId,
    this.description,
    this.brand = '',
    this.inStock = true,
    this.stockCount = 10,
    this.specifications = const {},
    this.isDeliveryAvailable = true,
    this.isInstallationAvailable = false,
    this.installationPrice,
    this.offerPrice,
    this.offerEndsAt,
    this.offerBadge,
    this.createdAt,
    this.hidden = false,
    this.hiddenReason = '',
    this.status = 'published',
    this.priceUsd,
    this.offerPriceUsd,
    this.installationPriceUsd,
    this.usdRateApplied,
  });

  final String id;
  final String name;

  /// Optional. `null` means "price on request" and is never treated as 0,
  /// because 0 is a real price.
  @override
  final double? price;
  final String currency;
  final String? imageUrl;

  /// Every picture of the product, the main one first; the company web panel
  /// can add up to 5. Empty when it has none.
  final List<String> imageUrls;
  final String? companyId;
  final String? companyName;

  /// References the official `categories` collection managed by Platform
  /// Admin. `null` means the product has no category yet (legacy data);
  /// existing products are never migrated automatically.
  final String? categoryId;
  final String? description;

  /// The make ("HP"); empty when the company gave none.
  final String brand;
  final bool inStock;
  final int stockCount;
  final Map<String, String> specifications;

  /// When false, customers cannot choose delivery and must use company pickup.
  final bool isDeliveryAvailable;
  final bool isInstallationAvailable;
  final double? installationPrice;

  @override
  final double? offerPrice;
  @override
  final DateTime? offerEndsAt;
  @override
  final OfferBadge? offerBadge;
  final DateTime? createdAt;

  /// Platform Admin hid this product from customers. It stays in its
  /// company's own list, marked, with [hiddenReason] so the company knows why.
  final bool hidden;
  final String hiddenReason;

  /// The company's own visibility: `published`, `draft` or `archived`. A
  /// document without it is published. The app never writes it (the company
  /// web panel does), so an edit here leaves it as it is.
  final String status;

  /// What the company typed in US dollars, for a product it prices in dollars
  /// (null otherwise). [price], [offerPrice] and [installationPrice] stay in
  /// Sudanese pounds, worked out from the company's dollar rate
  /// ([usdRateApplied]), so customers and orders read pounds as before.
  final double? priceUsd;
  final double? offerPriceUsd;
  final double? installationPriceUsd;
  final double? usdRateApplied;

  bool get isPricedInUsd => priceUsd != null;

  /// The company has not taken this product off sale (a draft or an archived
  /// product is kept from customers).
  bool get isPublished => status == 'published';

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
    imageUrls: imageUrls,
    companyId: companyId,
    companyName: companyName,
    categoryId: categoryId,
    description: description,
    brand: brand,
    inStock: inStock,
    stockCount: stockCount,
    specifications: specifications,
    isDeliveryAvailable: isDeliveryAvailable,
    isInstallationAvailable: isInstallationAvailable,
    installationPrice: installationPrice,
    offerPrice: offerPrice,
    offerEndsAt: offerEndsAt,
    offerBadge: offerBadge,
    createdAt: createdAt,
    hidden: hidden,
    hiddenReason: hiddenReason,
    status: status,
    priceUsd: priceUsd,
    offerPriceUsd: offerPriceUsd,
    installationPriceUsd: installationPriceUsd,
    usdRateApplied: usdRateApplied,
  );

  /// This product with [offerPrice] until [offerEndsAt] under [badge]; a
  /// `null` offer price removes the offer. On a product priced in dollars,
  /// [offerPriceUsd] is the offer as the company typed it.
  Product withOffer(
    double? offerPrice,
    DateTime? offerEndsAt, [
    OfferBadge? badge,
    double? offerPriceUsd,
  ]) => Product(
    id: id,
    name: name,
    price: price,
    currency: currency,
    imageUrl: imageUrl,
    imageUrls: imageUrls,
    companyId: companyId,
    companyName: companyName,
    categoryId: categoryId,
    description: description,
    brand: brand,
    inStock: inStock,
    stockCount: stockCount,
    specifications: specifications,
    isDeliveryAvailable: isDeliveryAvailable,
    isInstallationAvailable: isInstallationAvailable,
    installationPrice: installationPrice,
    offerPrice: offerPrice,
    offerEndsAt: offerPrice == null ? null : offerEndsAt,
    offerBadge: offerPrice == null ? null : badge,
    createdAt: createdAt,
    hidden: hidden,
    hiddenReason: hiddenReason,
    status: status,
    priceUsd: priceUsd,
    offerPriceUsd: offerPrice == null || priceUsd == null ? null : offerPriceUsd,
    installationPriceUsd: installationPriceUsd,
    usdRateApplied: usdRateApplied,
  );
}
