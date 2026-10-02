import 'package:cloud_firestore/cloud_firestore.dart' show Timestamp;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_colors.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/company_admin_format.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/orders/company_order_details_screen.dart';
import 'package:sudan_it_marketplace/features/orders/data/models/order_model.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/domain/repositories/orders_repository.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_details_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_labels.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/widgets/order_card.dart';
import 'package:sudan_it_marketplace/features/technician/presentation/technician_format.dart';
import 'package:sudan_it_marketplace/features/technicians/presentation/technicians_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

final _created = DateTime(2026, 9, 20, 10);

OrderEntity _order({
  OrderStatus status = OrderStatus.processing,
  PaymentStatus payment = PaymentStatus.pendingVerification,
  bool installation = false,
  bool stockReserved = true,
  bool stockReleased = false,
  OrderCancelReason? reason,
  DateTime? cancelledAt,
  DateTime? createdAt,
}) =>
    OrderEntity(
      id: 'order1234',
      customerId: 'cust1',
      companyId: 'c1',
      companyName: 'Nile Tech',
      productId: 'p1',
      productName: 'Router',
      quantity: 2,
      unitPrice: 100,
      productSubtotal: 200,
      installationSelected: installation,
      installationFee: installation ? 50 : 0,
      deliveryFee: 15000,
      totalAmount: installation ? 15250 : 15200,
      deliveryAddress: 'Street 1',
      contactPhone: '0911111111',
      paymentStatus: payment,
      orderStatus: status,
      stockReserved: stockReserved,
      stockReleased: stockReleased,
      cancelReason: reason,
      cancelledAt: cancelledAt,
      createdAt: createdAt ?? _created,
    );

OrderEntity _cancelled({
  OrderCancelReason reason = OrderCancelReason.company,
  bool stockReleased = true,
  bool installation = false,
}) =>
    _order(
      status: OrderStatus.cancelled,
      reason: reason,
      stockReleased: stockReleased,
      installation: installation,
      cancelledAt: DateTime(2026, 9, 21, 12, 30),
    );

/// Records what the company's screen asks the repository to do.
class _RecordingOrders extends Fake implements OrdersRepository {
  final cancelled = <(String, OrderCancelReason)>[];

  @override
  Future<void> cancelOrder({
    required String orderId,
    required OrderCancelReason reason,
  }) async {
    cancelled.add((orderId, reason));
  }
}

Widget _companyScreen(OrderEntity order, {OrdersRepository? orders}) {
  return ProviderScope(
    overrides: [
      companyOrdersStreamProvider('c1').overrideWith((_) => Stream.value([order])),
      companyTechniciansStreamProvider('c1').overrideWith((_) => Stream.value([])),
      chatConversationProvider(order.id).overrideWith((_) => Stream.value(null)),
      if (orders != null) ordersRepositoryProvider.overrideWithValue(orders),
    ],
    child: MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: CompanyOrderDetailsScreen(companyId: 'c1', orderId: order.id),
    ),
  );
}

Widget _customerApp(Widget home) => ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
        home: home,
      ),
    );

Future<void> _scrollTo(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
}

void main() {
  group('a cancelled order is never read as Processing', () {
    test('the stored value parses to cancelled, unknown values stay Processing', () {
      expect(OrderStatus.fromValue('cancelled'), OrderStatus.cancelled);
      expect(OrderStatus.fromValue('processing'), OrderStatus.processing);
      expect(OrderStatus.fromValue('something-else'), OrderStatus.processing);
      expect(OrderStatus.cancelled.value, 'cancelled');
    });

    test('a stored cancelled order keeps its reason, time and stock flags', () {
      final model = OrderModel.fromMap({
        'customerId': 'cust1',
        'companyId': 'c1',
        'productId': 'p1',
        'productName': 'Router',
        'quantity': 2,
        'orderStatus': 'cancelled',
        'paymentStatus': 'pending_verification',
        'cancelReason': 'expired',
        'stockReserved': true,
        'stockReleased': true,
      }, 'o1');
      final order = model.toEntity();
      expect(order.orderStatus, OrderStatus.cancelled);
      expect(order.isCancelled, isTrue);
      expect(order.cancelReason, OrderCancelReason.expired);
      expect(order.stockReserved, isTrue);
      expect(order.stockReleased, isTrue);
      expect(order.companyMayCancel, isFalse);
    });

    test('an older order without the flags reads as having taken its stock '
        '(placed before stock moved to the confirmation)', () {
      final order = OrderModel.fromMap({'orderStatus': 'processing'}, 'old').toEntity();
      expect(order.stockReserved, isTrue);
      expect(order.stockReleased, isFalse);
      expect(order.cancelReason, isNull);
      expect(OrderCancelReason.fromValue('made-up'), isNull);
    });

    test('only an explicit false reads as "no stock taken"; missing or null '
        'never does, whatever the order date', () {
      OrderModel read(Map<String, dynamic> map) => OrderModel.fromMap(map, 'o');
      expect(read({'stockReserved': false}).stockReserved, isFalse);
      expect(read({'stockReserved': true}).stockReserved, isTrue);
      expect(read({}).stockReserved, isTrue);
      expect(read({'stockReserved': null}).stockReserved, isTrue);
      for (final createdAt in [DateTime(2026, 9, 1), DateTime(2030)]) {
        expect(read({'createdAt': Timestamp.fromDate(createdAt)}).stockReserved, isTrue);
        expect(
          read({'stockReserved': false, 'createdAt': Timestamp.fromDate(createdAt)}).stockReserved,
          isFalse,
        );
      }
    });

    test('every new order says it took no stock (it is taken at the payment '
        'confirmation)', () {
      final map = OrderModel(
        id: 'o1',
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
        deliveryAddress: 'Street 1',
        contactPhone: '0911111111',
        paymentStatus: PaymentStatus.pendingVerification,
        orderStatus: OrderStatus.processing,
        createdAt: _created,
      ).toFirestoreCreateMap();
      expect(map['stockReserved'], isFalse);
      // The cancellation fields are never written by the customer.
      expect(map.containsKey('stockReleased'), isFalse);
      expect(map.containsKey('cancelReason'), isFalse);
    });

    test('labels and colours in both languages', () {
      final en = AppLocalizationsEn();
      final ar = AppLocalizationsAr();
      expect(OrderStatus.cancelled.label(en), 'Cancelled');
      expect(OrderStatus.cancelled.label(ar), 'ملغى');
      expect(OrderStatus.cancelled.label(en), isNot(OrderStatus.processing.label(en)));
      expect(OrderStatus.cancelled.jobLabel(en), 'Cancelled');
      expect(OrderStatus.cancelled.tone, AppTone.error);
      // Its payment is not shown as still waiting for verification.
      expect(_cancelled().paymentLabel(en), 'Not verified');
      expect(_cancelled().paymentLabel(ar), 'لم يُتحقق منه');
      expect(_cancelled().paymentTone, AppTone.neutral);
      expect(_order().paymentLabel(en), 'Pending Verification');
      expect(OrderCancelReason.expired.label(en), contains('24 hours'));
    });

    test('nothing follows a cancelled order, for the company or the technician', () {
      expect(CompanyAdminFormat.nextStatus(_cancelled()), isNull);
      expect(TechnicianFormat.nextStatus(_cancelled(installation: true)), isNull);
    });
  });

  group('when an order can be cancelled', () {
    test('the payment waits for confirmation only while Processing and not '
        'verified', () {
      expect(_order().isAwaitingPaymentVerification, isTrue);
      expect(_order(payment: PaymentStatus.confirmed).isAwaitingPaymentVerification,
          isFalse);
      expect(_order(status: OrderStatus.outForDelivery).isAwaitingPaymentVerification,
          isFalse);
      expect(
        _order(status: OrderStatus.completed, payment: PaymentStatus.confirmed)
            .isAwaitingPaymentVerification,
        isFalse,
      );
      expect(_cancelled().isAwaitingPaymentVerification, isFalse);
    });

    test('the company may still cancel a confirmed order while Processing', () {
      expect(_order().companyMayCancel, isTrue);
      expect(_order(payment: PaymentStatus.confirmed).companyMayCancel, isTrue);
      expect(
        _order(status: OrderStatus.outForDelivery, payment: PaymentStatus.confirmed)
            .companyMayCancel,
        isFalse,
      );
      expect(
        _order(status: OrderStatus.completed, payment: PaymentStatus.confirmed)
            .companyMayCancel,
        isFalse,
      );
      expect(_cancelled().companyMayCancel, isFalse);
      expect(_order().isAwaitingPaymentVerification, isTrue);
      expect(_order(payment: PaymentStatus.confirmed).isAwaitingPaymentVerification, isFalse);
    });

    test('the 24-hour window is only a hint for which orders to try', () {
      final order = _order();
      expect(OrderEntity.paymentVerificationWindow, const Duration(hours: 24));
      expect(
        order.isPaymentVerificationOverdue(
            _created.add(const Duration(hours: 23, minutes: 59))),
        isFalse,
      );
      expect(order.isPaymentVerificationOverdue(_created.add(const Duration(hours: 24))), isTrue);
      // A verified, moved-on or cancelled order never expires.
      final later = _created.add(const Duration(days: 3));
      expect(_order(payment: PaymentStatus.confirmed).isPaymentVerificationOverdue(later), isFalse);
      expect(_order(status: OrderStatus.outForDelivery).isPaymentVerificationOverdue(later), isFalse);
      expect(_cancelled().isPaymentVerificationOverdue(later), isFalse);
    });
  });

  group('the customer sees a cancelled order as cancelled', () {
    testWidgets('the order card says Cancelled, not Processing', (tester) async {
      await tester.pumpWidget(_customerApp(Scaffold(body: OrderCard(order: _cancelled()))));
      await tester.pumpAndSettle();
      expect(find.text('Cancelled'), findsOneWidget);
      expect(find.text('Processing'), findsNothing);
    });

    testWidgets('the order page explains the cancellation instead of the progress',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        _customerApp(OrderDetailsScreen(order: _cancelled(reason: OrderCancelReason.expired))),
      );
      await tester.pumpAndSettle();
      await _scrollTo(tester, find.text('This order was cancelled'));
      expect(find.text('This order was cancelled'), findsOneWidget);
      expect(find.textContaining('not verified within 24 hours'), findsOneWidget);
      expect(find.textContaining('Cancelled on 2026-09-21'), findsOneWidget);
      // No progress steps and no stock details for the customer.
      expect(find.text('Out for Delivery'), findsNothing);
      expect(find.textContaining('back to stock'), findsNothing);
    });
  });

  group("the company's order page", () {
    testWidgets('an unverified Processing order can be cancelled after confirming',
        (tester) async {
      final orders = _RecordingOrders();
      await tester.pumpWidget(_companyScreen(_order(), orders: orders));
      await tester.pumpAndSettle();
      await _scrollTo(tester, find.text('Cancel order'));

      await tester.tap(find.text('Cancel order'));
      await tester.pumpAndSettle();
      // The confirmation says what happens to the stock and the payment.
      expect(find.textContaining('its 2 units go back to stock'), findsOneWidget);
      expect(find.textContaining('arrange the refund'), findsOneWidget);

      // Keeping the order does nothing.
      await tester.tap(find.text('Keep order'));
      await tester.pumpAndSettle();
      expect(orders.cancelled, isEmpty);

      await tester.tap(find.text('Cancel order'));
      await tester.pumpAndSettle();
      await tester.tap(find.descendant(
        of: find.byType(AlertDialog),
        matching: find.text('Cancel order'),
      ));
      await tester.pumpAndSettle();
      expect(orders.cancelled, [('order1234', OrderCancelReason.company)]);
      expect(find.text('Order cancelled.'), findsOneWidget);
    });

    testWidgets('an order whose payment is not confirmed took no stock: none goes back',
        (tester) async {
      await tester.pumpWidget(_companyScreen(_order(stockReserved: false), orders: _RecordingOrders()));
      await tester.pumpAndSettle();
      await _scrollTo(tester, find.text('Cancel order'));
      await tester.tap(find.text('Cancel order'));
      await tester.pumpAndSettle();
      expect(find.textContaining('it took no stock and none goes back'), findsOneWidget);
      expect(find.textContaining('return it outside the app'), findsOneWidget);
    });

    testWidgets('a payment-confirmed order still Processing can be cancelled: its stock '
        'goes back and the money is returned outside the app', (tester) async {
      final orders = _RecordingOrders();
      await tester.pumpWidget(
        _companyScreen(_order(payment: PaymentStatus.confirmed), orders: orders),
      );
      await tester.pumpAndSettle();
      await _scrollTo(tester, find.text('Cancel order'));
      expect(find.text('Mark Out for Delivery'), findsOneWidget);

      await tester.tap(find.text('Cancel order'));
      await tester.pumpAndSettle();
      expect(find.textContaining('its 2 units go back to stock'), findsOneWidget);
      expect(
        find.textContaining('Its payment was confirmed: return 15,200 SDG to the customer outside the app'),
        findsOneWidget,
      );
      await tester.tap(find.descendant(
        of: find.byType(AlertDialog),
        matching: find.text('Cancel order'),
      ));
      await tester.pumpAndSettle();
      expect(orders.cancelled, [('order1234', OrderCancelReason.company)]);
    });

    testWidgets('an Out for Delivery order has no Cancel button', (tester) async {
      await tester.pumpWidget(_companyScreen(_order(
        status: OrderStatus.outForDelivery,
        payment: PaymentStatus.confirmed,
      )));
      await tester.pumpAndSettle();
      await _scrollTo(tester, find.text('Manage Order'));
      expect(find.text('Cancel order'), findsNothing);
    });

    testWidgets('a cancelled order is final: no payment, status or technician actions',
        (tester) async {
      await tester.pumpWidget(_companyScreen(_cancelled(installation: true)));
      await tester.pumpAndSettle();
      expect(find.text('Cancelled'), findsWidgets);
      expect(find.text('Processing'), findsNothing);
      await _scrollTo(tester, find.text('This order was cancelled'));
      expect(find.text('Cancelled by the company.'), findsOneWidget);
      expect(find.text('2 units went back to stock.'), findsOneWidget);
      expect(find.text('Confirm Payment'), findsNothing);
      expect(find.text('Cancel order'), findsNothing);
      expect(find.text('Mark Out for Delivery'), findsNothing);
      expect(find.text('Assign Technician'), findsNothing);
      expect(find.text('Change Technician'), findsNothing);
      expect(find.text('Pending Verification'), findsNothing);
    });

    testWidgets('a cancellation that returned no stock says so', (tester) async {
      await tester.pumpWidget(_companyScreen(_cancelled(stockReleased: false)));
      await tester.pumpAndSettle();
      await _scrollTo(tester, find.text('This order was cancelled'));
      expect(find.textContaining('No stock went back: the order had taken none'), findsOneWidget);
    });
  });
}
