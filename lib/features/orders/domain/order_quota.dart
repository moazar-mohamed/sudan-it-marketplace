/// A customer may place at most [OrderQuota.ordersPerDay] orders in any
/// [OrderQuota.window], against spam. It does not protect stock: an order
/// takes none until the company confirms its payment.
///
/// It mirrors `orderCountsAgainstQuota` in `firestore.rules`, which is what
/// actually enforces it with the server's clock. The customer's quota keeps
/// the times of their last five orders in five slots written in turn;
/// [next] is the slot the next order writes, and it always holds the oldest
/// of the five. Orders cancelled later still count.
class OrderQuota {
  OrderQuota({required List<DateTime?> times, required this.next})
      : assert(times.length == ordersPerDay),
        assert(next >= 0 && next < ordersPerDay),
        _times = List.unmodifiable(times);

  /// A customer who has never ordered.
  factory OrderQuota.none() =>
      OrderQuota(times: List.filled(ordersPerDay, null), next: 0);

  static const ordersPerDay = 5;
  static const window = Duration(hours: 24);

  final List<DateTime?> _times;

  /// The slot (0 to 4) the next order writes.
  final int next;

  /// The slot after [next], which the order after that writes.
  int get following => (next + 1) % ordersPerDay;

  /// When the oldest of the last five orders was placed; null while there
  /// have been fewer than five.
  DateTime? get oldest => _times[next];

  /// When the next order becomes allowed, or null when it is allowed at
  /// [now]. The phone's clock only decides whether to try: a phone clock
  /// that is behind can make a customer wait longer, never order sooner.
  DateTime? nextOrderAllowedAt(DateTime now) {
    final oldest = this.oldest;
    if (oldest == null) return null;
    final allowedAt = oldest.add(window);
    return now.isBefore(allowedAt) ? allowedAt : null;
  }
}

/// Thrown, before anything is written, when the customer has already placed
/// [OrderQuota.ordersPerDay] orders in the last [OrderQuota.window].
class OrderQuotaReachedException implements Exception {
  const OrderQuotaReachedException({this.nextOrderAt});

  /// When the customer may order again (by the phone's clock).
  final DateTime? nextOrderAt;

  @override
  String toString() =>
      'OrderQuotaReachedException(next order at: $nextOrderAt)';
}
