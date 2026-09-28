/// The label an offer carries on its card. The discount badge shows the
/// percentage; the others show fixed text.
enum OfferBadge {
  discount,
  special,
  limited;

  /// The stored value, or null when [value] is not a known badge.
  static OfferBadge? parse(Object? value) {
    for (final badge in values) {
      if (badge.name == value) return badge;
    }
    return null;
  }
}

/// Offer behaviour shared by anything a company sells at a price: a product
/// or a service. [price] stays the normal price and the offer is kept beside
/// it, so an offer ends on its own at [offerEndsAt] with nothing to restore.
mixin OfferPricing {
  double? get price;

  /// The discounted price while the offer runs. Always below [price].
  double? get offerPrice;

  /// When the offer stops; `null` means it runs until the company ends it.
  DateTime? get offerEndsAt;

  /// The label on the offer's card; `null` shows the discount.
  OfferBadge? get offerBadge;

  /// An offer is set and it has a price below the normal one.
  bool get hasOffer {
    final offer = offerPrice;
    final normal = price;
    return offer != null && normal != null && offer < normal;
  }

  /// An offer is running: it is set and has not reached its end date.
  bool get hasActiveOffer {
    if (!hasOffer) return false;
    final ends = offerEndsAt;
    return ends == null || DateTime.now().isBefore(ends);
  }

  /// An offer that reached its end date and was not removed.
  bool get hasEndedOffer => hasOffer && !hasActiveOffer;

  /// What a customer pays right now: the offer price while an offer runs,
  /// otherwise the normal price.
  double? get salePrice => hasActiveOffer ? offerPrice : price;

  /// The offer's discount as a whole percentage, or 0 without an offer.
  int get offerDiscountPercent =>
      hasOffer ? ((1 - offerPrice! / price!) * 100).round() : 0;
}
