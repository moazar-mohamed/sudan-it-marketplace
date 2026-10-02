import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/order_quota.dart';

/// Firestore mapping of a customer's order quota (`order_quota/{uid}`): the
/// slots `t0`..`t4` (server times), `next` and `lastOrderId`, the only keys
/// `isOrderQuotaWrite` in the rules allows. It is written only in the same
/// transaction as a new order of its customer, never on its own.
class OrderQuotaModel {
  const OrderQuotaModel._();

  static const collection = 'order_quota';

  /// The stored quota, or [OrderQuota.none] when the customer has none yet.
  /// A slot that is not a time reads as empty; a `next` outside 0..4 reads as
  /// 0 (the rules refuse to move such a quota on, so the order is refused).
  static OrderQuota fromMap(Map<String, dynamic>? data) {
    if (data == null) return OrderQuota.none();
    final next = data['next'];
    return OrderQuota(
      times: [
        for (var slot = 0; slot < OrderQuota.ordersPerDay; slot++)
          switch (data['t$slot']) {
            final Timestamp time => time.toDate(),
            _ => null,
          },
      ],
      next: next is int && next >= 0 && next < OrderQuota.ordersPerDay
          ? next
          : 0,
    );
  }

  /// The fields that count [orderId] against [quota]: the server's time in
  /// the slot [OrderQuota.next], `next` moved on and the order's id. For a
  /// customer's first order this is the whole new document.
  static Map<String, Object> step(OrderQuota quota, String orderId) => {
        't${quota.next}': FieldValue.serverTimestamp(),
        'next': quota.following,
        'lastOrderId': orderId,
      };
}
