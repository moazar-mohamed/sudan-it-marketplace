import '../../products/domain/entities/product.dart';

/// Pure price check shared by the order transaction and the tests.
///
/// The security rules recompute every money field of a new order from the
/// product document (with the server's clock deciding whether an offer still
/// runs) and refuse any other value. The order transaction runs this check on
/// the freshly read product first, so a price, offer or installation price
/// that changed while the customer was paying is reported as a price change
/// instead of as a refused write.
class OrderPricing {
  const OrderPricing._();

  /// Whether an order's unit price and installation fee are still what
  /// [product] charges now. A product without a price never matches: a
  /// missing price is never treated as 0.
  static bool matchesProduct({
    required Product product,
    required double unitPrice,
    required bool installationSelected,
    required double installationFee,
  }) {
    final salePrice = product.salePrice;
    if (salePrice == null || unitPrice != salePrice) {
      return false;
    }
    if (!installationSelected) {
      return installationFee == 0;
    }
    return product.isInstallationAvailable &&
        product.installationPrice != null &&
        installationFee == product.installationPrice;
  }
}
