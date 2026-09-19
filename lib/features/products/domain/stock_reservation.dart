/// Thrown when an order asks for more units than a product has left.
///
/// [message] is written for the customer; it is what the checkout shows.
class StockUnavailableException implements Exception {
  const StockUnavailableException({
    required this.message,
    required this.available,
    required this.requested,
  });

  final String message;
  final int available;
  final int requested;

  @override
  String toString() => message;
}

/// Pure stock arithmetic shared by the order transaction and the tests.
///
/// `stockCount` is the number of physical units currently available for sale,
/// so an order consumes its *quantity*, not one unit per order.
class StockReservation {
  const StockReservation._();

  /// Units left after selling [requested] of [available] units.
  ///
  /// Throws [StockUnavailableException] instead of ever returning a negative
  /// number, so stock can never be oversold.
  static int remainingAfter({
    required int available,
    required int requested,
    required String productName,
  }) {
    if (requested < 1) {
      throw StockUnavailableException(
        message: 'Choose at least one unit to order.',
        available: available,
        requested: requested,
      );
    }
    if (available <= 0) {
      throw StockUnavailableException(
        message: '$productName is out of stock.',
        available: 0,
        requested: requested,
      );
    }
    if (requested > available) {
      throw StockUnavailableException(
        message: 'Only $available of $productName left in stock. '
            'Please reduce the quantity.',
        available: available,
        requested: requested,
      );
    }
    return available - requested;
  }
}
