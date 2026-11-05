import 'entities/product.dart';

/// How old a company's dollar rate is, which colours the rate card on the
/// company's Home.
enum UsdRateAge {
  /// Set or confirmed within the last day.
  fresh,

  /// A day old: time to update or confirm it.
  due,

  /// Two days old or more: the prices may be wrong.
  stale,
}

/// Dollar pricing. A company may type a product's prices in US dollars; the
/// Sudanese-pound prices customers see (and orders are checked against) are
/// worked out from the company's own dollar rate (`companies/{id}.usdRate`)
/// and stored on the product, so everything that reads `price` keeps working.
///
/// Keep the sums in step with company_web/src/data/usdPricing.ts: the app and
/// the web panel must give the same pounds for the same dollars.
abstract final class UsdPricing {
  /// Pound prices are rounded to this step.
  static const int step = 500;

  /// A new rate further than this from the old one (a share of it) asks the
  /// company to confirm, to catch a typo such as 30000 for 3000.
  static const double bigChange = 0.2;

  /// The rules accept a rate in this range.
  static const double minRate = 1;
  static const double maxRate = 1000000;

  static const Duration dueAfter = Duration(hours: 24);
  static const Duration staleAfter = Duration(hours: 48);

  // A product's dollars times the rate is not always exact in floating point
  // (1.1 x 5000 is 5500.000000000001), so a sum within this of a step counts
  // as that step.
  static const double _slack = 1e-6;

  /// The price in pounds: rounded up to the step, so the company never sells
  /// below what it typed.
  static double price(double usd, double rate) =>
      ((usd * rate / step) - _slack).ceil() * step.toDouble();

  /// An offer in pounds: rounded down to the step (one step at least). With
  /// the price rounded up, an offer below the price in dollars always stays
  /// below it in pounds, as the rules require.
  static double offer(double usd, double rate) {
    final steps = ((usd * rate / step) + _slack).floor();
    return (steps < 1 ? 1 : steps) * step.toDouble();
  }

  /// Whether [rate] is one the rules accept.
  static bool isValidRate(double? rate) =>
      rate != null && rate.isFinite && rate >= minRate && rate <= maxRate;

  /// Whether going from [oldRate] to [newRate] is a big enough jump to ask
  /// the company first.
  static bool isBigChange(double? oldRate, double newRate) =>
      oldRate != null &&
      oldRate > 0 &&
      (newRate - oldRate).abs() / oldRate > bigChange;

  static UsdRateAge ageOf(DateTime? updatedAt, DateTime now) {
    if (updatedAt == null) return UsdRateAge.stale;
    final age = now.difference(updatedAt);
    if (age >= staleAfter) return UsdRateAge.stale;
    if (age >= dueAfter) return UsdRateAge.due;
    return UsdRateAge.fresh;
  }

  /// Whether [product] is priced in dollars and its pounds were not worked out
  /// from [rate] (the rate changed, or an earlier rewrite was cut short).
  static bool needsRepricing(Product product, double rate) =>
      product.priceUsd != null && product.usdRateApplied != rate;

  /// The fields that bring [product] to [rate]: its pounds worked out again,
  /// and the rate they use. An offer made before the product moved to dollars
  /// keeps its share of the price; a dollar offer whose pounds were taken off
  /// (by the platform admin ending it) is dropped too.
  static Map<String, Object?> repricedFields(Product product, double rate) {
    final usd = product.priceUsd!;
    final newPrice = price(usd, rate);
    final fields = <String, Object?>{
      'price': newPrice,
      'usdRateApplied': rate,
    };
    final offerUsd = product.offerPriceUsd;
    final offerNow = product.offerPrice;
    if (offerNow == null) {
      if (offerUsd != null) fields['offerPriceUsd'] = null;
    } else {
      final oldPrice = product.price;
      final usdOffer = offerUsd != null && offerUsd < usd
          ? offerUsd
          : usd * (oldPrice != null && oldPrice > 0 ? offerNow / oldPrice : 1);
      final newOffer = offer(usdOffer, rate);
      if (newOffer < newPrice) {
        fields['offerPrice'] = newOffer;
      } else {
        // Too close to the price to stay below it once rounded (the rules
        // would refuse it, and with it the whole rewrite): the offer ends.
        fields.addAll({
          'offerPrice': null,
          'offerEndsAt': null,
          'offerBadge': null,
          'offerPriceUsd': null,
        });
      }
    }
    final installationUsd = product.installationPriceUsd;
    if (product.isInstallationAvailable && installationUsd != null) {
      fields['installationPrice'] = price(installationUsd, rate);
    }
    return fields;
  }
}
