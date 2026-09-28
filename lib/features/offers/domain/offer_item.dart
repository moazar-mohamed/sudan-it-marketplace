import '../../company_services/domain/entities/company_service.dart';
import '../../products/domain/entities/product.dart';
import '../../services/domain/entities/catalog_service.dart';
import 'offer_pricing.dart';

/// Something a company can put on offer, seen the same way wherever offers
/// are listed: one of its products, or one of its services.
sealed class OfferItem {
  const OfferItem();

  OfferPricing get pricing;
  String get id;
  String get name;
  String get companyName;
  String? get imageUrl;
  String? get categoryId;
  String get currency => 'SDG';
}

class ProductOfferItem extends OfferItem {
  const ProductOfferItem(this.product);

  final Product product;

  @override
  OfferPricing get pricing => product;
  @override
  String get id => product.id;
  @override
  String get name => product.name;
  @override
  String get companyName => product.companyName ?? '';
  @override
  String? get imageUrl => product.imageUrl;
  @override
  String? get categoryId => product.categoryId;
  @override
  String get currency => product.currency;
}

class ServiceOfferItem extends OfferItem {
  const ServiceOfferItem({
    required this.link,
    required this.service,
    required this.companyName,
  });

  /// The company's own offering of [service], which carries price and offer.
  final CompanyService link;
  final CatalogService service;
  @override
  final String companyName;

  @override
  OfferPricing get pricing => link;
  @override
  String get id => link.id;
  @override
  String get name => service.name;
  @override
  String? get imageUrl => null;
  @override
  String? get categoryId => service.categoryId;
}

/// Items with a running offer, biggest discount first.
List<OfferItem> runningOffers(Iterable<OfferItem> items) =>
    items.where((item) => item.pricing.hasActiveOffer).toList()
      ..sort(
        (a, b) => b.pricing.offerDiscountPercent
            .compareTo(a.pricing.offerDiscountPercent),
      );
