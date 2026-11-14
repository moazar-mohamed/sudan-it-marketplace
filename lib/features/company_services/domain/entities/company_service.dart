import '../../../offers/domain/offer_pricing.dart';

class CompanyService with OfferPricing {
  const CompanyService({
    required this.id,
    required this.companyId,
    required this.serviceId,
    required this.isActive,
    required this.createdAt,
    this.price,
    this.note,
    this.offerPrice,
    this.offerEndsAt,
    this.offerBadge,
  });

  final String id;
  final String companyId;
  final String serviceId;
  final bool isActive;
  final DateTime createdAt;

  /// The company's own price for this service. Optional: `null` means the
  /// company set no price, and then nothing is shown. Never stored as 0.
  @override
  final double? price;

  /// The company's own short text about how it performs this service.
  final String? note;

  @override
  final double? offerPrice;
  @override
  final DateTime? offerEndsAt;
  @override
  final OfferBadge? offerBadge;

  bool get hasPrice => price != null;

  /// This service with [offerPrice] until [offerEndsAt] under [badge]; a
  /// `null` offer price removes the offer.
  CompanyService withOffer(
    double? offerPrice,
    DateTime? offerEndsAt, [
    OfferBadge? badge,
  ]) =>
      CompanyService(
        id: id,
        companyId: companyId,
        serviceId: serviceId,
        isActive: isActive,
        createdAt: createdAt,
        price: price,
        note: note,
        offerPrice: offerPrice,
        offerEndsAt: offerPrice == null ? null : offerEndsAt,
        offerBadge: offerPrice == null ? null : badge,
      );

  /// The note, or null when it is empty.
  String? get noteText {
    final text = note?.trim() ?? '';
    return text.isEmpty ? null : text;
  }
}
