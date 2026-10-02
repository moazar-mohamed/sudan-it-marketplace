import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/errors/app_exception.dart';
import 'package:sudan_it_marketplace/features/orders/data/datasources/firestore_orders_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/orders/data/datasources/orders_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/orders/data/models/order_model.dart';
import 'package:sudan_it_marketplace/features/orders/data/models/order_quota_model.dart';
import 'package:sudan_it_marketplace/features/orders/data/repositories/orders_repository_impl.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/domain/order_exceptions.dart';
import 'package:sudan_it_marketplace/features/orders/domain/order_quota.dart';
import 'package:sudan_it_marketplace/features/products/domain/stock_reservation.dart';

import 'helpers/fake_firestore.dart';
import 'helpers/receipt_fakes.dart';

// ORD-4 (Option 3), the data layer: an order takes no stock when it is
// placed; the company takes it when it confirms the payment. These tests run
// the REAL FirestoreOrdersRemoteDataSource against the in-memory Firestore in
// helpers/fake_firestore.dart, which has transactions but no security rules.
// Where a test needs the rules to refuse something, it says so and makes the
// fake refuse it; the rules themselves are tested against the emulator in
// platform_admin_web/rules-tests/order-stock-at-confirmation.rules.test.ts.

/// The keys each write may carry, exactly the lists the rules allow
/// (isCompanyPaymentConfirmation, isCompanyOrderCancellation, isStockReturn,
/// isOrderQuotaWrite), so the app never sends a write the rules refuse for
/// its shape.
const _confirmOrderKeys = {'paymentStatus', 'stockReserved', 'updatedAt'};
const _confirmLegacyOrderKeys = {'paymentStatus', 'updatedAt'};
const _confirmProductKeys = {'stockCount', 'lastOrderId', 'updatedAt'};
const _cancelOrderKeys = {
  'orderStatus',
  'cancelReason',
  'cancelledAt',
  'stockReleased',
  'updatedAt',
};
const _returnProductKeys = {'stockCount', 'lastReleasedOrderId', 'updatedAt'};

Map<String, dynamic> _product({
  String companyId = 'c1',
  Object stockCount = 10,
  double price = 100,
}) =>
    {
      'id': 'p1',
      'companyId': companyId,
      'companyName': 'Alpha Tech',
      'name': 'Router',
      'price': price,
      'currency': 'SDG',
      'stockCount': stockCount,
      'inStock': true,
      'isDeliveryAvailable': true,
      'isInstallationAvailable': false,
      'updatedAt': Timestamp.fromDate(DateTime(2026, 9, 1)),
    };

/// An order as it is stored. [stockReserved] null leaves the field out (an
/// order from before the marker existed).
Map<String, dynamic> _order({
  String orderStatus = 'processing',
  String paymentStatus = 'pending_verification',
  bool? stockReserved = false,
  int quantity = 2,
  Duration age = const Duration(hours: 1),
}) =>
    {
      'id': 'o1',
      'customerId': 'cust1',
      'companyId': 'c1',
      'companyName': 'Alpha Tech',
      'productId': 'p1',
      'productName': 'Router',
      'quantity': quantity,
      'unitPrice': 100.0,
      'productSubtotal': 100.0 * quantity,
      'installationSelected': false,
      'installationFee': 0.0,
      'deliveryFee': 15000.0,
      'totalAmount': 15000.0 + 100 * quantity,
      'deliveryAddress': 'Street 1',
      'contactPhone': '+249912345678',
      'deliveryMethod': 'delivery',
      'paymentStatus': paymentStatus,
      'orderStatus': orderStatus,
      'receiptFileName': 'receipt.jpg',
      'stockReserved': ?stockReserved,
      'createdAt': Timestamp.fromDate(DateTime.now().subtract(age)),
      'updatedAt': Timestamp.fromDate(DateTime.now().subtract(age)),
    };

/// What checkout hands over: [quantity] units of p1 for delivery.
OrderModel _draft(String id, {int quantity = 2, double unitPrice = 100}) =>
    OrderModel(
      id: id,
      customerId: 'cust1',
      companyId: 'c1',
      companyName: 'Alpha Tech',
      productId: 'p1',
      productName: 'Router',
      quantity: quantity,
      unitPrice: unitPrice,
      productSubtotal: unitPrice * quantity,
      installationSelected: false,
      installationFee: 0,
      deliveryFee: 15000,
      totalAmount: 15000 + unitPrice * quantity,
      deliveryAddress: 'Street 15, Khartoum',
      contactPhone: '+249912345678',
      customerName: 'Customer One',
      paymentStatus: PaymentStatus.pendingVerification,
      orderStatus: OrderStatus.processing,
      receiptFileName: 'receipt.jpg',
      createdAt: DateTime(2026),
    );

/// A quota whose slots were written [ages] ago (null = empty), with [next].
Map<String, dynamic> _quota(List<Duration?> ages, {required int next}) => {
      for (var slot = 0; slot < ages.length; slot++)
        if (ages[slot] != null)
          't$slot': Timestamp.fromDate(DateTime.now().subtract(ages[slot]!)),
      'next': next,
      'lastOrderId': 'earlier',
    };

/// The receipt document an order was placed with.
Map<String, dynamic> _storedReceipt(String orderId) => {
      'orderId': orderId,
      'customerId': 'cust1',
      'companyId': 'c1',
      'fileName': 'receipt.jpg',
    };

Matcher _appError(AppErrorCode code) =>
    throwsA(isA<AppException>().having((e) => e.code, 'code', code));

Matcher _confirmationRefused(PaymentConfirmationIssue issue) => throwsA(
      isA<PaymentConfirmationException>().having((e) => e.issue, 'issue', issue),
    );

Matcher _stockRefused(StockIssue issue) => throwsA(
      isA<StockUnavailableException>().having((e) => e.issue, 'issue', issue),
    );

void main() {
  late FakeFirestore store;
  late FirestoreOrdersRemoteDataSource orders;

  setUp(() {
    store = FakeFirestore();
    store.put('products/p1', _product());
    orders = FirestoreOrdersRemoteDataSource(firestore: store);
  });

  Map<String, Map<String, dynamic>> writesOf(List<FakeWrite> commit) =>
      {for (final write in commit) write.path: write.data};

  int stock() => store.read('products/p1')!['stockCount'] as int;

  Future<CreatedOrder> place(String id, {int quantity = 2}) => orders
      .createOrder(_draft(id, quantity: quantity), receipt: smallReceipt());

  /// Places [id] and says how it went, for many orders at once.
  Future<String> placeAndTell(String id) async {
    try {
      await place(id, quantity: 1);
      return 'placed';
    } on OrderQuotaReachedException {
      return 'quota';
    } on AppException catch (error) {
      return error.code.name;
    }
  }

  /// The rules refuse to confirm the payment of an order with no stored
  /// receipt (isCompanyPaymentConfirmation); the fake has no rules.
  void refuseConfirmationWithoutReceipt(String orderId) {
    store.rejectCommit = (path) =>
        path == 'orders/$orderId' && store.read('order_receipts/$orderId') == null
            ? 'permission-denied'
            : null;
  }

  // ----------------------------------------------------------- placing
  group('placing an order takes no stock', () {
    test('the order, its receipt, its quota step and its conversation are '
        'written in one commit; the product is not written', () async {
      final created = await place('o1');

      expect(created.id, 'o1');
      expect(store.commits, hasLength(1));
      final writes = writesOf(store.commits.single);
      expect(writes.keys, [
        'orders/o1',
        'order_receipts/o1',
        'order_quota/cust1',
        'chats/o1',
      ]);
      expect(writes.keys, isNot(contains('products/p1')));
      expect(stock(), 10);
      expect(store.read('products/p1')!.containsKey('lastOrderId'), isFalse);

      final order = store.read('orders/o1')!;
      expect(order['stockReserved'], isFalse);
      expect(order['paymentStatus'], 'pending_verification');
      expect(order['orderStatus'], 'processing');
      // The order names the receipt it was stored with.
      expect(order['receiptFileName'], store.read('order_receipts/o1')!['fileName']);
      expect(order['createdAt'], FieldValue.serverTimestamp());
    });

    test('the name on the order is the receipt\'s own, whatever the draft said',
        () async {
      await orders.createOrder(
        _draft('o1'),
        receipt: smallReceipt(fileName: 'bank-transfer.jpg'),
      );
      expect(store.read('orders/o1')!['receiptFileName'], 'bank-transfer.jpg');
      expect(store.read('order_receipts/o1')!['fileName'], 'bank-transfer.jpg');
    });

    test('without a receipt nothing is sent at all', () async {
      await expectLater(
        orders.createOrder(_draft('o1')),
        _appError(AppErrorCode.orderCreateFailed),
      );
      expect(store.transactionAttempts, 0);
      expect(store.commits, isEmpty);
      expect(store.read('orders/o1'), isNull);
      expect(store.read('order_quota/cust1'), isNull);
    });

    test('the repository refuses it too: an order is never placed without its '
        'receipt image', () async {
      final repository = OrdersRepositoryImpl(orders);
      await expectLater(
        repository.createOrder(
          orderId: 'o1',
          customerId: 'cust1',
          companyId: 'c1',
          productId: 'p1',
          productName: 'Router',
          quantity: 1,
          unitPrice: 100,
          productSubtotal: 100,
          installationSelected: false,
          installationFee: 0,
          deliveryFee: 15000,
          totalAmount: 15100,
          deliveryAddress: 'Khartoum',
          contactPhone: '+249912345678',
          receiptFileName: 'only-a-name.jpg',
        ),
        _appError(AppErrorCode.orderCreateFailed),
      );
      expect(store.commits, isEmpty);
    });

    test('a product with fewer units than ordered is refused, nothing written',
        () async {
      store.put('products/p1', _product(stockCount: 1));
      await expectLater(place('o1'), _stockRefused(StockIssue.insufficient));
      expect(store.commits, isEmpty);
    });

    test("another company's product under the same id is refused", () async {
      store.put('products/p1', _product(companyId: 'c2'));
      await expectLater(
        place('o1'),
        _stockRefused(StockIssue.noLongerAvailable),
      );
      expect(store.commits, isEmpty);
    });

    test('a changed price is refused before anything is written (SEC-001)',
        () async {
      store.put('products/p1', _product(price: 120));
      await expectLater(place('o1'), _appError(AppErrorCode.orderPriceChanged));
      expect(store.commits, isEmpty);
    });

    test('a refusal by the rules (an e-mail that is not verified, say) stores '
        'nothing, and is not tried again when nothing changed', () async {
      store.rejectCommit =
          (path) => path == 'orders/o1' ? 'permission-denied' : null;
      await expectLater(place('o1'), _appError(AppErrorCode.orderCreateDenied));
      expect(store.transactionAttempts, 1);
      expect(store.read('orders/o1'), isNull);
      expect(store.read('order_receipts/o1'), isNull);
      expect(store.read('order_quota/cust1'), isNull);
    });

    test('a commit refused because the company edited the product meanwhile '
        'is tried again with a fresh read', () async {
      store.staleCommitCode = 'permission-denied';
      store.beforeCommit = (attempt) {
        if (store.transactionAttempts == 1) {
          store.put('products/p1', {
            ..._product(),
            'description': 'edited',
            'updatedAt': Timestamp.fromDate(DateTime(2026, 9, 30)),
          });
        }
      };
      await place('o1');
      expect(store.transactionAttempts, 2);
      expect(store.read('orders/o1'), isNotNull);
    });

    test('an order already stored under this id that is not this one is not '
        'taken for it', () async {
      store.put('orders/o1', {..._order(quantity: 7), 'customerId': 'cust1'});
      store.rejectCommit =
          (path) => path == 'orders/o1' ? 'permission-denied' : null;
      await expectLater(place('o1'), _appError(AppErrorCode.orderCreateDenied));
    });

    test('an answer lost after the commit: the stored order comes back, '
        'placed and counted once', () async {
      store.serverClock = DateTime.now;
      store.acknowledgementLost = 'unavailable';
      final created = await place('o1');
      expect(created.id, 'o1');
      expect(store.commits, hasLength(1));
      expect(store.read('order_quota/cust1')!['next'], 1);
      expect(stock(), 10);
    });
  });

  // ------------------------------------------------------------- quota
  group('at most ten orders in any 24 hours', () {
    const limit = OrderQuota.ordersPerDay;
    // The age of each order of a full quota, oldest first: [limit] hours down to 1.
    List<Duration?> fullAges() =>
        [for (var h = limit; h >= 1; h--) Duration(hours: h)];
    setUp(() => store.serverClock = DateTime.now);

    test("a customer's first order starts the quota", () async {
      await place('o1');
      final quota = store.read('order_quota/cust1')!;
      expect(quota.keys, unorderedEquals(['t0', 'next', 'lastOrderId']));
      expect(quota['t0'], isA<Timestamp>());
      expect(quota['next'], 1);
      expect(quota['lastOrderId'], 'o1');
      // Sent as the server's time, never the phone's.
      final sent = writesOf(store.commits.single)['order_quota/cust1']!;
      expect(sent['t0'], FieldValue.serverTimestamp());
    });

    test('with room left, the order fills the next slot and moves next on',
        () async {
      store.put(
        'order_quota/cust1',
        _quota([const Duration(hours: 3), const Duration(hours: 2)], next: 2),
      );
      await place('o1');
      final sent = writesOf(store.commits.single)['order_quota/cust1']!;
      // Only the slot, next and lastOrderId (isOrderQuotaWrite).
      expect(sent.keys, unorderedEquals(['t2', 'next', 'lastOrderId']));
      expect(store.read('order_quota/cust1')!['next'], 3);
    });

    test('one order more than the limit within 24 hours is refused, nothing '
        'written', () async {
      final oldest = DateTime.now().subtract(const Duration(hours: limit));
      store.put('order_quota/cust1', {
        ..._quota([null, ...fullAges().skip(1)], next: 0),
        't0': Timestamp.fromDate(oldest),
      });

      await expectLater(
        place('over'),
        throwsA(isA<OrderQuotaReachedException>().having(
          (e) => e.nextOrderAt,
          'nextOrderAt',
          oldest.add(const Duration(hours: 24)),
        )),
      );
      expect(store.commits, isEmpty);
      expect(store.read('orders/over'), isNull);
      expect(store.read('order_receipts/over'), isNull);
    });

    test('it is a rolling window: once the oldest is 24 hours old, its slot '
        'is free again', () async {
      store.put(
        'order_quota/cust1',
        _quota([const Duration(hours: 25), ...fullAges().skip(1)], next: 0),
      );
      await place('again');
      final quota = store.read('order_quota/cust1')!;
      expect(quota['next'], 1);
      expect(quota['lastOrderId'], 'again');
      final t0 = (quota['t0'] as Timestamp).toDate();
      expect(DateTime.now().difference(t0), lessThan(const Duration(minutes: 1)));
    });

    test('ten orders in a row go through, the eleventh does not', () async {
      for (var i = 1; i <= limit; i++) {
        await place('o$i', quantity: 1);
      }
      await expectLater(place('over', quantity: 1), throwsA(isA<OrderQuotaReachedException>()));
      expect(store.read('order_quota/cust1')!['next'], 0);
      expect(store.commits, hasLength(limit));
    });

    test('cancelled orders still count', () async {
      for (var i = 1; i <= limit; i++) {
        await place('o$i', quantity: 1);
      }
      store.put('orders/o1', {...store.read('orders/o1')!, 'orderStatus': 'cancelled'});
      await expectLater(place('over', quantity: 1), throwsA(isA<OrderQuotaReachedException>()));
    });

    test('twice the limit sent at once: exactly the limit goes through, each '
        'once', () async {
      const sent = limit * 2;
      final results = await Future.wait([
        for (var i = 0; i < sent; i++) placeAndTell('o$i'),
      ]);
      expect(results.where((r) => r == 'placed'), hasLength(limit));
      expect(results.where((r) => r == 'quota'), hasLength(limit));
      final placed = [
        for (var i = 0; i < sent; i++)
          if (results[i] == 'placed') 'o$i',
      ];
      for (var i = 0; i < sent; i++) {
        expect(store.read('orders/o$i') != null, placed.contains('o$i'), reason: 'o$i');
        expect(store.read('order_receipts/o$i') != null, placed.contains('o$i'));
      }
      final quota = OrderQuotaModel.fromMap(store.read('order_quota/cust1'));
      expect(quota.next, 0);
      expect(quota.oldest, isNotNull); // all ten slots written
      expect(store.commits, hasLength(limit));
      expect(stock(), 10);
    });

    test('twice the limit at once where the rules refuse a stale commit (as '
        'the emulator does): never more than the limit, never an order twice',
        () async {
      const sent = limit * 2;
      store.staleCommitCode = 'permission-denied';
      final results = await Future.wait([
        for (var i = 0; i < sent; i++) placeAndTell('o$i'),
      ]);
      final placed = [
        for (var i = 0; i < sent; i++)
          if (results[i] == 'placed') 'o$i',
      ];
      expect(placed.length, inInclusiveRange(1, limit));
      expect(
        results.where((r) => r != 'placed'),
        everyElement(anyOf('quota', AppErrorCode.orderCreateDenied.name)),
      );
      // Every commit is one order, and the quota counted each exactly once.
      expect(store.commits, hasLength(placed.length));
      final quota = store.read('order_quota/cust1')!;
      expect(quota['next'], placed.length % OrderQuota.ordersPerDay);
      final slots = [for (var s = 0; s < limit; s++) quota['t$s']].whereType<Timestamp>();
      expect(slots, hasLength(placed.length));
      for (var i = 0; i < sent; i++) {
        expect(store.read('orders/o$i') != null, placed.contains('o$i'));
      }
    });

    test('a commit refused because the same customer\'s other order took the '
        'slot first is tried again with a fresh read', () async {
      store.staleCommitCode = 'permission-denied';
      store.beforeCommit = (attempt) {
        if (store.transactionAttempts == 1) {
          // Another device of the same customer places o0 in between.
          store.put('orders/o0', _order());
          store.put('order_quota/cust1', {
            't0': Timestamp.now(),
            'next': 1,
            'lastOrderId': 'o0',
          });
        }
      };
      await place('o1');
      expect(store.transactionAttempts, 2);
      final quota = store.read('order_quota/cust1')!;
      expect(quota['next'], 2);
      expect(quota['lastOrderId'], 'o1');
      expect(quota['t1'], isA<Timestamp>());
      expect(store.commits, hasLength(1));
    });

    test("losing every attempt to the same customer's other orders, which "
        'fill the quota: told the quota is reached, not "not allowed"',
        () async {
      // The app tries four times; each time another order of the same
      // customer lands first, so the fourth leaves the quota full.
      const start = limit - 4;
      store.put('order_quota/cust1', {
        for (var s = 0; s < start; s++) 't$s': Timestamp.now(),
        'next': start % limit,
        'lastOrderId': 'other0',
      });
      store.staleCommitCode = 'permission-denied';
      store.beforeCommit = (_) {
        final filled = start + store.transactionAttempts;
        store.put('order_quota/cust1', {
          for (var s = 0; s < filled; s++) 't$s': Timestamp.now(),
          'next': filled % limit,
          'lastOrderId': 'other$filled',
        });
      };
      await expectLater(place('o9'), throwsA(isA<OrderQuotaReachedException>()));
      expect(store.transactionAttempts, 4);
      expect(store.read('orders/o9'), isNull);
    });

    test('the last free order racing one more: one goes through, the other is '
        'told the quota is reached', () async {
      store.put(
        'order_quota/cust1',
        _quota(fullAges().take(limit - 1).toList(), next: limit - 1),
      );
      final results = await Future.wait([placeAndTell('last'), placeAndTell('extra')]);
      expect(results, unorderedEquals(['placed', 'quota']));
      expect(store.read('order_quota/cust1')!['next'], 0);
    });

    test('the quota in the app mirrors the rules', () {
      expect(OrderQuota.ordersPerDay, 10);
      expect(OrderQuota.window, const Duration(hours: 24));
      final now = DateTime(2026, 10, 1, 12);
      final full = OrderQuota(
        times: [for (var h = 10; h >= 1; h--) now.subtract(Duration(hours: h))],
        next: 0,
      );
      expect(full.nextOrderAllowedAt(now), now.add(const Duration(hours: 14)));
      expect(full.nextOrderAllowedAt(now.add(const Duration(hours: 14))), isNull);
      expect(full.following, 1);
      expect(OrderQuota.none().nextOrderAllowedAt(now), isNull);
      expect(OrderQuotaModel.fromMap({'next': 10}).next, 0);
      expect(OrderQuotaModel.fromMap({'t0': 'not a time', 'next': 0}).oldest, isNull);
    });
  });

  // ---------------------------------------------------- confirming payment
  group('confirming the payment takes the stock, once', () {
    setUp(() {
      store.put('orders/o1', _order());
      store.put('order_receipts/o1', _storedReceipt('o1'));
    });

    test('stock lowered by the quantity, order confirmed, in one commit with '
        'only the fields the rules allow', () async {
      final serverTime = DateTime(2026, 10, 1, 9);
      store.serverClock = () => serverTime;
      final confirmed = await orders.confirmPayment('o1');

      expect(confirmed.paymentStatus, PaymentStatus.confirmed);
      expect(confirmed.stockReserved, isTrue);
      // What comes back is read from the server, not built on the phone.
      expect(confirmed.updatedAt, serverTime);
      expect(stock(), 8);
      expect(store.read('products/p1')!['lastOrderId'], 'o1');
      final order = store.read('orders/o1')!;
      expect(order['paymentStatus'], 'confirmed');
      expect(order['stockReserved'], isTrue);

      final writes = writesOf(store.commits.single);
      expect(writes.keys, unorderedEquals(['products/p1', 'orders/o1']));
      expect(writes['orders/o1']!.keys.toSet(), _confirmOrderKeys);
      expect(writes['products/p1']!.keys.toSet(), _confirmProductKeys);
      expect(writes['orders/o1']!['updatedAt'], FieldValue.serverTimestamp());
    });

    test('the price the customer paid stays, even after the product\'s price '
        'changed', () async {
      store.put('products/p1', _product(price: 150));
      await orders.confirmPayment('o1');
      final order = store.read('orders/o1')!;
      expect(order['unitPrice'], 100.0);
      expect(order['totalAmount'], 15200.0);
      expect(stock(), 8);
    });

    test('a second confirmation is refused and takes nothing', () async {
      await orders.confirmPayment('o1');
      await expectLater(
        orders.confirmPayment('o1'),
        _confirmationRefused(PaymentConfirmationIssue.alreadyConfirmed),
      );
      expect(stock(), 8);
      expect(store.commits, hasLength(1));
    });

    test('not enough stock: refused, nothing written at all; the order keeps '
        'waiting and is confirmed after a restock', () async {
      store.put('products/p1', _product(stockCount: 1));
      await expectLater(
        orders.confirmPayment('o1'),
        _stockRefused(StockIssue.insufficient),
      );
      expect(store.commits, isEmpty);
      expect(stock(), 1);
      expect(store.read('orders/o1')!['paymentStatus'], 'pending_verification');

      store.put('products/p1', _product(stockCount: 5));
      await orders.confirmPayment('o1');
      expect(stock(), 3);
    });

    test('a sold-out product: refused as out of stock, nothing written',
        () async {
      store.put('products/p1', _product(stockCount: 0));
      await expectLater(
        orders.confirmPayment('o1'),
        _stockRefused(StockIssue.outOfStock),
      );
      expect(store.commits, isEmpty);
    });

    for (final (label, change) in [
      ('deleted', () => store.remove('products/p1')),
      ("now another company's", () => store.put('products/p1', _product(companyId: 'c2'))),
      ('holding a stock that is not a whole number', () => store.put('products/p1', _product(stockCount: 5.0))),
    ]) {
      test('a product $label: refused, nothing written', () async {
        change();
        await expectLater(orders.confirmPayment('o1'), throwsA(isA<StockUnavailableException>()));
        expect(store.commits, isEmpty);
      });
    }

    for (final (label, fields) in [
      ('cancelled', {'orderStatus': 'cancelled'}),
      ('out for delivery', {'orderStatus': 'out_for_delivery'}),
      ('completed', {'orderStatus': 'completed'}),
      ('of an unknown payment state', {'paymentStatus': 'refunded'}),
    ]) {
      test('an order $label: refused, nothing written', () async {
        store.put('orders/o1', {..._order(), ...fields});
        await expectLater(
          orders.confirmPayment('o1'),
          _confirmationRefused(PaymentConfirmationIssue.notAwaitingPayment),
        );
        expect(store.commits, isEmpty);
        expect(stock(), 10);
      });
    }

    test('a missing order: refused', () async {
      await expectLater(
        orders.confirmPayment('nope'),
        _confirmationRefused(PaymentConfirmationIssue.notAwaitingPayment),
      );
    });

    test('two devices confirming the same order at once: one deduction, the '
        'other is told it is already confirmed', () async {
      final results = await Future.wait([
        for (var i = 0; i < 2; i++)
          orders.confirmPayment('o1').then<Object>((o) => o, onError: (Object e) => e),
      ]);
      expect(results.whereType<OrderModel>(), hasLength(1));
      expect(
        results.whereType<PaymentConfirmationException>().single.issue,
        PaymentConfirmationIssue.alreadyConfirmed,
      );
      expect(stock(), 8);
      expect(store.commits, hasLength(1));
    });

    test('the same, where the rules refuse the stale commit (as the emulator '
        'does)', () async {
      store.staleCommitCode = 'permission-denied';
      final results = await Future.wait([
        for (var i = 0; i < 2; i++)
          orders.confirmPayment('o1').then<Object>((o) => o, onError: (Object e) => e),
      ]);
      expect(results.whereType<OrderModel>(), hasLength(1));
      expect(results.whereType<PaymentConfirmationException>(), hasLength(1));
      expect(stock(), 8);
    });

    for (final staleRefused in [false, true]) {
      test('six paid orders for the last three units, confirmed at once: '
          'exactly three, stock never below zero'
          '${staleRefused ? ' (stale commits refused)' : ''}', () async {
        store.put('products/p1', _product(stockCount: 3));
        for (var i = 0; i < 6; i++) {
          store.put('orders/o$i', {..._order(quantity: 1), 'id': 'o$i'});
          store.put('order_receipts/o$i', _storedReceipt('o$i'));
        }
        if (staleRefused) store.staleCommitCode = 'permission-denied';

        final results = await Future.wait([
          for (var i = 0; i < 6; i++)
            orders.confirmPayment('o$i').then<Object>((o) => o, onError: (Object e) => e),
        ]);
        expect(results.whereType<OrderModel>(), hasLength(3));
        expect(results.whereType<StockUnavailableException>(), hasLength(3));
        expect(stock(), 0);
        final confirmed = [
          for (var i = 0; i < 6; i++)
            if (store.read('orders/o$i')!['paymentStatus'] == 'confirmed') 'o$i',
        ];
        expect(confirmed, hasLength(3));
        for (final id in confirmed) {
          expect(store.read('orders/$id')!['stockReserved'], isTrue);
        }
      });
    }

    test('the answer lost after the commit: the order is read back, '
        'confirmed, and the stock was taken once', () async {
      store.acknowledgementLost = 'unavailable';
      final confirmed = await orders.confirmPayment('o1');
      expect(confirmed.paymentStatus, PaymentStatus.confirmed);
      expect(store.commits, hasLength(1));
      expect(stock(), 8);
    });

    test('the answer lost on the last attempt is still read back as '
        'confirmed, not reported as a failure', () async {
      var refusals = 0;
      store.rejectCommit = (path) =>
          path == 'orders/o1' && refusals++ < 3 ? 'permission-denied' : null;
      store.beforeCommit = (_) {
        if (store.transactionAttempts == 4) store.acknowledgementLost = 'unavailable';
      };
      final confirmed = await orders.confirmPayment('o1');
      expect(confirmed.paymentStatus, PaymentStatus.confirmed);
      expect(store.transactionAttempts, 4);
      expect(store.commits, hasLength(1));
      expect(stock(), 8);
    });

    test('a commit that failed without being applied is tried again, and '
        'takes the stock once', () async {
      var failures = 0;
      store.rejectCommit = (path) => failures++ == 0 ? 'unavailable' : null;
      final confirmed = await orders.confirmPayment('o1');
      expect(confirmed.paymentStatus, PaymentStatus.confirmed);
      expect(store.transactionAttempts, 2);
      expect(store.commits, hasLength(1));
      expect(stock(), 8);
    });

    test('the answer lost and the order cannot be read back: the company is '
        'told it failed; confirming again by hand takes nothing more',
        () async {
      store.acknowledgementLost = 'unavailable';
      store.failReads = true;
      await expectLater(
        orders.confirmPayment('o1'),
        _appError(AppErrorCode.orderConfirmPaymentFailed),
      );
      expect(stock(), 8); // the commit did land

      store.failReads = false;
      await expectLater(
        orders.confirmPayment('o1'),
        _confirmationRefused(PaymentConfirmationIssue.alreadyConfirmed),
      );
      expect(stock(), 8);
      expect(store.commits, hasLength(1));
    });

    test('a refusal that no fresh read explains is reported as not allowed, '
        'after a few attempts and with nothing written', () async {
      store.rejectCommit = (path) => 'permission-denied';
      await expectLater(
        orders.confirmPayment('o1'),
        _appError(AppErrorCode.orderConfirmPaymentDenied),
      );
      expect(store.transactionAttempts, 4);
      expect(store.commits, isEmpty);
      expect(stock(), 10);
    });

    test('the repository hands back the confirmed order', () async {
      final confirmed = await OrdersRepositoryImpl(orders).confirmPayment('o1');
      expect(confirmed.paymentStatus, PaymentStatus.confirmed);
      expect(confirmed.stockReserved, isTrue);
    });
  });

  // ----------------------------------------------------- orders from before
  group('orders placed before stock moved to the confirmation', () {
    test('one that already took its stock is confirmed without taking more',
        () async {
      store.put('orders/o1', _order(stockReserved: true));
      store.put('order_receipts/o1', _storedReceipt('o1'));

      final confirmed = await orders.confirmPayment('o1');

      expect(confirmed.paymentStatus, PaymentStatus.confirmed);
      expect(stock(), 10);
      final writes = writesOf(store.commits.single);
      expect(writes.keys, ['orders/o1']);
      expect(writes['orders/o1']!.keys.toSet(), _confirmLegacyOrderKeys);
    });

    test('one without the stock marker took its stock when it was placed: '
        'confirmed without taking more, the marker stays absent', () async {
      store.put('orders/o1', _order(stockReserved: null));
      store.put('order_receipts/o1', _storedReceipt('o1'));

      final confirmed = await orders.confirmPayment('o1');

      expect(confirmed.paymentStatus, PaymentStatus.confirmed);
      expect(confirmed.stockReserved, isTrue);
      expect(stock(), 10);
      final writes = writesOf(store.commits.single);
      expect(writes.keys, ['orders/o1']);
      expect(writes['orders/o1']!.keys.toSet(), _confirmLegacyOrderKeys);
      expect(store.read('orders/o1')!.containsKey('stockReserved'), isFalse);
    });

    test('one without the stock marker: a second confirmation takes nothing',
        () async {
      store.put('orders/o1', _order(stockReserved: null));
      store.put('order_receipts/o1', _storedReceipt('o1'));
      await orders.confirmPayment('o1');
      await expectLater(
        orders.confirmPayment('o1'),
        _confirmationRefused(PaymentConfirmationIssue.alreadyConfirmed),
      );
      expect(stock(), 10);
      expect(store.commits, hasLength(1));
    });

    test('one without a stored receipt is not confirmed until a receipt '
        'exists', () async {
      store.put('orders/o1', _order());
      refuseConfirmationWithoutReceipt('o1');

      await expectLater(
        orders.confirmPayment('o1'),
        _confirmationRefused(PaymentConfirmationIssue.noReceipt),
      );
      expect(store.commits, isEmpty);
      expect(stock(), 10);
      expect(store.read('orders/o1')!['paymentStatus'], 'pending_verification');

      store.put('order_receipts/o1', _storedReceipt('o1'));
      await orders.confirmPayment('o1');
      expect(stock(), 8);
    });

    test('a reserved one without a receipt is not confirmed either', () async {
      store.put('orders/o1', _order(stockReserved: true));
      refuseConfirmationWithoutReceipt('o1');
      await expectLater(
        orders.confirmPayment('o1'),
        _confirmationRefused(PaymentConfirmationIssue.noReceipt),
      );
      expect(store.commits, isEmpty);
    });

    test('one stuck Out for Delivery with its payment never confirmed cannot '
        'be confirmed now', () async {
      store.put('orders/o1', _order(orderStatus: 'out_for_delivery', stockReserved: true));
      store.put('order_receipts/o1', _storedReceipt('o1'));
      await expectLater(
        orders.confirmPayment('o1'),
        _confirmationRefused(PaymentConfirmationIssue.notAwaitingPayment),
      );
    });
  });

  // ------------------------------------------------------------ cancelling
  group('cancelling', () {
    Future<void> cancel(OrderCancelReason reason) =>
        orders.cancelOrder(orderId: 'o1', reason: reason);

    test('a confirmed order still Processing: cancelled, its stock back once',
        () async {
      store.put('orders/o1', _order());
      store.put('order_receipts/o1', _storedReceipt('o1'));
      await orders.confirmPayment('o1');
      expect(stock(), 8);

      await cancel(OrderCancelReason.company);

      expect(stock(), 10);
      final order = store.read('orders/o1')!;
      expect(order['orderStatus'], 'cancelled');
      expect(order['paymentStatus'], 'confirmed');
      expect(order['stockReleased'], isTrue);
      expect(store.read('products/p1')!['lastReleasedOrderId'], 'o1');
      final writes = writesOf(store.commits.last);
      expect(writes['orders/o1']!.keys.toSet(), _cancelOrderKeys);
      expect(writes['products/p1']!.keys.toSet(), _returnProductKeys);
    });

    test('cancelling twice: the second is refused and gives nothing back',
        () async {
      store.put('orders/o1', _order(paymentStatus: 'confirmed', stockReserved: true));
      await cancel(OrderCancelReason.company);
      await expectLater(
        cancel(OrderCancelReason.company),
        _appError(AppErrorCode.orderCancelNotAllowed),
      );
      expect(stock(), 12);
    });

    test('an order not confirmed yet took no stock and gives none back',
        () async {
      store.put('orders/o1', _order());
      await cancel(OrderCancelReason.company);
      expect(store.read('orders/o1')!['stockReleased'], isFalse);
      expect(stock(), 10);
      expect(writesOf(store.commits.single).keys, ['orders/o1']);
    });

    for (final status in ['out_for_delivery', 'completed']) {
      test('a confirmed order $status cannot be cancelled', () async {
        store.put('orders/o1', _order(
          orderStatus: status,
          paymentStatus: 'confirmed',
          stockReserved: true,
        ));
        await expectLater(
          cancel(OrderCancelReason.company),
          _appError(AppErrorCode.orderCancelNotAllowed),
        );
        expect(store.commits, isEmpty);
      });
    }

    for (final reason in [OrderCancelReason.expired, OrderCancelReason.outOfStock]) {
      test('a confirmed order is never cancelled as ${reason.value}', () async {
        store.put('orders/o1', _order(paymentStatus: 'confirmed', stockReserved: true));
        store.put('products/p1', _product(stockCount: 0));
        await expectLater(cancel(reason), _appError(AppErrorCode.orderCancelNotAllowed));
        expect(store.commits, isEmpty);
      });
    }

    test('confirmed on another device while being cancelled: the retry gives '
        'back the stock the confirmation took', () async {
      store.put('orders/o1', _order());
      store.beforeCommit = (attempt) {
        if (attempt == 1) {
          store.put('orders/o1', _order(paymentStatus: 'confirmed', stockReserved: true));
          store.put('products/p1', {..._product(stockCount: 8), 'lastOrderId': 'o1'});
        }
      };
      await cancel(OrderCancelReason.company);
      expect(stock(), 10);
      expect(store.read('orders/o1')!['stockReleased'], isTrue);
    });

    group('as out of stock', () {
      test('refused while the product still covers the order, nothing written',
          () async {
        store.put('orders/o1', _order());
        await expectLater(
          cancel(OrderCancelReason.outOfStock),
          throwsA(isA<ProductStillCoversOrderException>()
              .having((e) => e.available, 'available', 10)
              .having((e) => e.requested, 'requested', 2)),
        );
        expect(store.commits, isEmpty);
      });

      test('exactly the quantity left still covers it: refused', () async {
        store.put('orders/o1', _order());
        store.put('products/p1', _product(stockCount: 2));
        await expectLater(
          cancel(OrderCancelReason.outOfStock),
          throwsA(isA<ProductStillCoversOrderException>()),
        );
      });

      test('allowed when the stock is below the quantity; no stock moves',
          () async {
        store.put('orders/o1', _order());
        store.put('products/p1', _product(stockCount: 1));
        await cancel(OrderCancelReason.outOfStock);
        final order = store.read('orders/o1')!;
        expect(order['cancelReason'], 'out_of_stock');
        expect(order['stockReleased'], isFalse);
        expect(stock(), 1);
      });

      for (final (label, change) in [
        ('deleted', () => store.remove('products/p1')),
        ("now another company's", () => store.put('products/p1', _product(companyId: 'c2'))),
      ]) {
        test('allowed when the product is $label', () async {
          store.put('orders/o1', _order());
          change();
          await cancel(OrderCancelReason.outOfStock);
          expect(store.read('orders/o1')!['cancelReason'], 'out_of_stock');
          expect(writesOf(store.commits.single).keys, ['orders/o1']);
        });
      }

      test('an older order that took its stock gets it back to its own '
          "company's product", () async {
        store.put('orders/o1', _order(stockReserved: true, quantity: 3));
        store.put('products/p1', _product(stockCount: 2));
        await cancel(OrderCancelReason.outOfStock);
        expect(stock(), 5);
        expect(store.read('orders/o1')!['stockReleased'], isTrue);
      });

      test('the reason is read back as out of stock', () {
        expect(OrderCancelReason.fromValue('out_of_stock'), OrderCancelReason.outOfStock);
        final order = OrderModel.fromMap(
          {..._order(orderStatus: 'cancelled'), 'cancelReason': 'out_of_stock'},
          'o1',
        );
        expect(order.cancelReason, OrderCancelReason.outOfStock);
      });
    });
  });

  // ---------------------------------------------------------------- expiry
  group('the 24-hour expiry', () {
    test('a confirmed order is never overdue, however old', () {
      final order = OrderModel.fromMap(
        _order(paymentStatus: 'confirmed', stockReserved: true, age: const Duration(days: 9)),
        'o1',
      ).toEntity();
      expect(order.isPaymentVerificationOverdue(DateTime.now()), isFalse);
      expect(order.companyMayCancel, isTrue);
      expect(order.isAwaitingPaymentVerification, isFalse);
    });

    test('the sweep cancels only waiting orders; a new one gives back no '
        'stock, an older reserved one gives back its own', () async {
      store.put('orders/new', {..._order(age: const Duration(hours: 30)), 'id': 'new'});
      store.put('orders/old', {
        ..._order(stockReserved: true, age: const Duration(hours: 30)),
        'id': 'old',
      });
      store.put('orders/paid', {
        ..._order(paymentStatus: 'confirmed', stockReserved: true, age: const Duration(hours: 30)),
        'id': 'paid',
      });

      expect(await orders.expireOverdueOrders('c1'), 2);

      expect(store.read('orders/new')!['cancelReason'], 'expired');
      expect(store.read('orders/new')!['stockReleased'], isFalse);
      expect(store.read('orders/old')!['stockReleased'], isTrue);
      expect(store.read('orders/paid')!['orderStatus'], 'processing');
      expect(stock(), 12); // only the older order's 2 units
    });
  });

  // ------------------------------------------------- assigning a technician
  group('assigning a technician', () {
    setUp(() {
      store.put('orders/o1', {
        ..._order(paymentStatus: 'confirmed', stockReserved: true),
        'installationSelected': true,
        'technicianId': 't1',
        'technicianName': 'Tech One',
      });
      // The rules refuse a write that changes nothing.
      store.rejectCommit = (path) {
        final order = store.read('orders/o1')!;
        return order['technicianId'] == 't1' && order['technicianName'] == 'Tech One'
            ? 'permission-denied'
            : null;
      };
    });

    test('the same technician again (a second tap) is already done, not an '
        'error', () async {
      await orders.assignTechnician(
        orderId: 'o1',
        technicianId: 't1',
        technicianName: 'Tech One',
      );
      expect(store.commits, isEmpty);
    });

    test('a refused assignment of another technician is still reported',
        () async {
      store.rejectCommit = (_) => 'permission-denied';
      await expectLater(
        orders.assignTechnician(orderId: 'o1', technicianId: 't2', technicianName: 'Tech Two'),
        _appError(AppErrorCode.orderAssignTechnicianDenied),
      );
    });
  });
}
