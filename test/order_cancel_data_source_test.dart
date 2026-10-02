import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/errors/app_exception.dart';
import 'package:sudan_it_marketplace/features/orders/data/datasources/firestore_orders_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';

import 'helpers/fake_firestore.dart';

/// The fields the cancellation may write, exactly the lists the security rules
/// allow (isCompanyOrderCancellation and isStockReturn in firestore.rules), so
/// the app never sends a write the rules must refuse for its shape.
const _orderCancelKeys = {
  'orderStatus',
  'cancelReason',
  'cancelledAt',
  'stockReleased',
  'updatedAt',
};
const _productReturnKeys = {'stockCount', 'lastReleasedOrderId', 'updatedAt'};

Map<String, dynamic> _product({String companyId = 'c1', int stockCount = 10}) => {
      'id': 'p1',
      'companyId': companyId,
      'name': 'Router',
      'price': 100,
      'stockCount': stockCount,
      'inStock': true,
    };

Map<String, dynamic> _order({
  String companyId = 'c1',
  String orderStatus = 'processing',
  String paymentStatus = 'pending_verification',
  bool? stockReserved = true,
  Duration age = const Duration(hours: 1),
}) =>
    {
      'customerId': 'cust1',
      'companyId': companyId,
      'productId': 'p1',
      'productName': 'Router',
      'quantity': 2,
      'unitPrice': 100,
      'productSubtotal': 200,
      'installationSelected': false,
      'installationFee': 0,
      'deliveryFee': 15000,
      'totalAmount': 15200,
      'deliveryAddress': 'Street 1',
      'contactPhone': '0911111111',
      'deliveryMethod': 'delivery',
      'paymentStatus': paymentStatus,
      'orderStatus': orderStatus,
      'stockReserved': ?stockReserved,
      'createdAt': Timestamp.fromDate(DateTime.now().subtract(age)),
      'updatedAt': Timestamp.fromDate(DateTime.now().subtract(age)),
    };

void main() {
  late FakeFirestore store;
  late FirestoreOrdersRemoteDataSource orders;

  setUp(() {
    store = FakeFirestore();
    store.put('products/p1', _product());
    orders = FirestoreOrdersRemoteDataSource(firestore: store);
  });

  Future<void> cancel(String id, [OrderCancelReason reason = OrderCancelReason.company]) =>
      orders.cancelOrder(orderId: id, reason: reason);

  Matcher refusedWith(AppErrorCode code) =>
      throwsA(isA<AppException>().having((e) => e.code, 'code', code));

  group('cancelOrder (the real transaction)', () {
    test('an order that took its stock: cancelled, and exactly its quantity goes back, '
        'in one commit', () async {
      store.put('orders/o1', _order());
      await cancel('o1');

      final order = store.read('orders/o1')!;
      expect(order['orderStatus'], 'cancelled');
      expect(order['cancelReason'], 'company');
      expect(order['stockReleased'], isTrue);
      expect(order['cancelledAt'], isA<FieldValue>());
      expect(order['updatedAt'], isA<FieldValue>());
      final product = store.read('products/p1')!;
      expect(product['stockCount'], 12);
      expect(product['lastReleasedOrderId'], 'o1');

      // One atomic commit, writing only the fields the rules allow.
      final commit = store.commits.single;
      final byPath = {for (final w in commit) w.path: w.data};
      expect(byPath.keys, unorderedEquals(['orders/o1', 'products/p1']));
      expect(byPath['orders/o1']!.keys.toSet(), _orderCancelKeys);
      expect(byPath['products/p1']!.keys.toSet(), _productReturnKeys);
    });

    test('the expired reason is written as such', () async {
      store.put('orders/o1', _order(age: const Duration(hours: 30)));
      await cancel('o1', OrderCancelReason.expired);
      expect(store.read('orders/o1')!['cancelReason'], 'expired');
    });

    test('an older order without the stock marker took its stock when placed: '
        'cancelled, it goes back exactly once', () async {
      store.put('orders/old', _order(stockReserved: null));
      await cancel('old');
      expect(store.read('orders/old')!['stockReleased'], isTrue);
      expect(store.read('orders/old')!.containsKey('stockReserved'), isFalse);
      expect(store.read('products/p1')!['stockCount'], 12);
      expect(store.read('products/p1')!['lastReleasedOrderId'], 'old');
      expect(store.commits.single.map((w) => w.path).toSet(), {'products/p1', 'orders/old'});
      await expectLater(cancel('old'), refusedWith(AppErrorCode.orderCancelNotAllowed));
      expect(store.read('products/p1')!['stockCount'], 12);
    });

    test('an older order without the stock marker, its payment confirmed: '
        'cancelled, its stock goes back exactly once', () async {
      store.put('orders/old', _order(stockReserved: null, paymentStatus: 'confirmed'));
      await cancel('old');
      expect(store.read('orders/old')!['stockReleased'], isTrue);
      expect(store.read('products/p1')!['stockCount'], 12);
      await expectLater(cancel('old'), refusedWith(AppErrorCode.orderCancelNotAllowed));
      expect(store.read('products/p1')!['stockCount'], 12);
    });

    test('only an explicit false means "took no stock": such an order gives none back', () async {
      store.put('orders/new', _order(stockReserved: false));
      await cancel('new');
      expect(store.read('orders/new')!['stockReleased'], isFalse);
      expect(store.read('products/p1')!['stockCount'], 10);
      expect(store.commits.single.map((w) => w.path), ['orders/new']);
    });

    test('a reserved order whose product was deleted: cancelled, no product write', () async {
      store.put('orders/o1', _order());
      store.remove('products/p1');
      await cancel('o1');
      expect(store.read('orders/o1')!['stockReleased'], isFalse);
      expect(store.commits.single.map((w) => w.path), ['orders/o1']);
    });

    test("a product id reused by another company never gets the order's stock", () async {
      store.put('orders/o1', _order());
      store.put('products/p1', _product(companyId: 'c2', stockCount: 5));
      await cancel('o1');
      expect(store.read('orders/o1')!['stockReleased'], isFalse);
      final product = store.read('products/p1')!;
      expect(product['stockCount'], 5);
      expect(product.containsKey('lastReleasedOrderId'), isFalse);
      expect(store.commits.single.map((w) => w.path), ['orders/o1']);
    });

    test('payment confirmed and still Processing: cancelled, its stock back once', () async {
      store.put('orders/o1', {..._order(), 'paymentStatus': 'confirmed'});
      await cancel('o1');
      expect(store.read('orders/o1')!['orderStatus'], 'cancelled');
      expect(store.read('orders/o1')!['stockReleased'], isTrue);
      expect(store.read('products/p1')!['stockCount'], 12);
      await expectLater(cancel('o1'), refusedWith(AppErrorCode.orderCancelNotAllowed));
      expect(store.read('products/p1')!['stockCount'], 12);
    });

    for (final (label, fields) in [
      ('out for delivery', {'orderStatus': 'out_for_delivery', 'paymentStatus': 'confirmed'}),
      ('completed', {'orderStatus': 'completed', 'paymentStatus': 'confirmed'}),
      ('already cancelled', {'orderStatus': 'cancelled'}),
    ]) {
      test('refused when $label, and nothing is written', () async {
        store.put('orders/o1', {..._order(), ...fields});
        await expectLater(cancel('o1'), refusedWith(AppErrorCode.orderCancelNotAllowed));
        expect(store.commits, isEmpty);
        expect(store.read('products/p1')!['stockCount'], 10);
      });
    }

    test('a missing order is refused', () async {
      await expectLater(cancel('nope'), refusedWith(AppErrorCode.orderCancelNotAllowed));
      expect(store.commits, isEmpty);
    });

    test('payment confirmed on another device mid-transaction: re-read, still cancelled, '
        'stock back once', () async {
      store.put('orders/o1', _order());
      store.beforeCommit = (attempt) {
        if (attempt == 1) {
          store.put('orders/o1', {..._order(), 'paymentStatus': 'confirmed'});
        }
      };
      await cancel('o1');
      expect(store.transactionAttempts, 2);
      expect(store.commits, hasLength(1));
      expect(store.read('products/p1')!['stockCount'], 12);
      expect(store.read('orders/o1')!['orderStatus'], 'cancelled');
      expect(store.read('orders/o1')!['paymentStatus'], 'confirmed');
    });

    test('moved on by another device mid-transaction: re-read and refused', () async {
      store.put('orders/o1', _order());
      store.beforeCommit = (attempt) {
        if (attempt == 1) {
          store.put('orders/o1', {
            ..._order(),
            'paymentStatus': 'confirmed',
            'orderStatus': 'out_for_delivery',
          });
        }
      };
      await expectLater(cancel('o1'), refusedWith(AppErrorCode.orderCancelNotAllowed));
      expect(store.transactionAttempts, 2);
      expect(store.commits, isEmpty);
      expect(store.read('products/p1')!['stockCount'], 10);
    });

    test('cancelled on another device mid-transaction: the stock goes back only once', () async {
      store.put('orders/o1', _order());
      store.beforeCommit = (attempt) {
        if (attempt == 1) {
          // The other device's cancellation commits first.
          store.put('orders/o1', {..._order(), 'orderStatus': 'cancelled', 'stockReleased': true});
          store.put('products/p1', {..._product(stockCount: 12), 'lastReleasedOrderId': 'o1'});
        }
      };
      await expectLater(cancel('o1'), refusedWith(AppErrorCode.orderCancelNotAllowed));
      expect(store.read('products/p1')!['stockCount'], 12);
      expect(store.commits, isEmpty);
    });

    test('a refusal by the security rules is reported as "not allowed to cancel"', () async {
      store.put('orders/o1', _order());
      store.rejectCommit = (_) => 'permission-denied';
      await expectLater(cancel('o1'), refusedWith(AppErrorCode.orderCancelDenied));
      expect(store.read('orders/o1')!['orderStatus'], 'processing');
      expect(store.read('products/p1')!['stockCount'], 10);
    });

    test('any other failure is reported as "could not cancel"', () async {
      store.put('orders/o1', _order());
      store.rejectCommit = (_) => 'unavailable';
      await expectLater(cancel('o1'), refusedWith(AppErrorCode.orderCancelFailed));
      expect(store.commits, isEmpty);
    });
  });

  group('expireOverdueOrders (the real sweep)', () {
    void seedOrders() {
      store.put('orders/overdue', _order(age: const Duration(hours: 25)));
      store.put('orders/justInTime', _order(age: const Duration(hours: 23, minutes: 59)));
      store.put('orders/fresh', _order());
      store.put('orders/confirmed', _order(paymentStatus: 'confirmed', age: const Duration(hours: 30)));
      store.put('orders/shipped', _order(
        orderStatus: 'out_for_delivery',
        paymentStatus: 'confirmed',
        age: const Duration(hours: 30),
      ));
      store.put('orders/otherCompany', _order(companyId: 'c2', age: const Duration(hours: 30)));
      store.put('orders/legacy', _order(stockReserved: null, age: const Duration(hours: 48)));
    }

    test("cancels only this company's unverified orders older than 24 hours, as expired", () async {
      seedOrders();
      final expired = await orders.expireOverdueOrders('c1');

      expect(expired, 2);
      expect(store.read('orders/overdue')!['orderStatus'], 'cancelled');
      expect(store.read('orders/overdue')!['cancelReason'], 'expired');
      expect(store.read('orders/overdue')!['stockReleased'], isTrue);
      expect(store.read('orders/legacy')!['orderStatus'], 'cancelled');
      // No stock marker: it took its stock when it was placed, so it goes back.
      expect(store.read('orders/legacy')!['stockReleased'], isTrue);
      for (final untouched in ['justInTime', 'fresh', 'confirmed', 'shipped', 'otherCompany']) {
        expect(store.read('orders/$untouched')!.containsKey('cancelReason'), isFalse,
            reason: untouched);
      }
      // The overdue reserved order and the unmarked one each gave 2 units back.
      expect(store.read('products/p1')!['stockCount'], 14);
    });

    test('an order the server refuses (its clock says not yet) is skipped, the rest go on', () async {
      seedOrders();
      store.rejectCommit = (path) => path == 'orders/overdue' ? 'permission-denied' : null;
      final expired = await orders.expireOverdueOrders('c1');
      expect(expired, 1);
      expect(store.read('orders/overdue')!['orderStatus'], 'processing');
      expect(store.read('orders/legacy')!['orderStatus'], 'cancelled');
      expect(store.read('products/p1')!['stockCount'], 12);
    });

    test('never throws when the orders cannot be read', () async {
      seedOrders();
      store.failQueries = true;
      expect(await orders.expireOverdueOrders('c1'), 0);
      expect(store.commits, isEmpty);
    });

    test('running it twice changes nothing the second time', () async {
      seedOrders();
      expect(await orders.expireOverdueOrders('c1'), 2);
      expect(await orders.expireOverdueOrders('c1'), 0);
      expect(store.read('products/p1')!['stockCount'], 14);
    });
  });
}
