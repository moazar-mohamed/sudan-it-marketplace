import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/orders/company_order_details_screen.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/entities/app_notification.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notifications_providers.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/domain/order_exceptions.dart';
import 'package:sudan_it_marketplace/features/orders/domain/order_quota.dart';
import 'package:sudan_it_marketplace/features/orders/domain/repositories/orders_repository.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_details_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_error_message.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_labels.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_pending_verification_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_controller.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/widgets/order_card.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/stock_reservation.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/technician/presentation/jobs/technician_job_status_actions.dart';
import 'package:sudan_it_marketplace/features/technicians/presentation/technicians_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

// ORD-4 Phase 3: what the screens say and offer now that an order takes no
// stock until the company confirms its payment (see
// order_stock_at_confirmation_test.dart for the data layer).

final _en = AppLocalizationsEn();
final _ar = AppLocalizationsAr();

OrderEntity _order({
  OrderStatus status = OrderStatus.processing,
  PaymentStatus payment = PaymentStatus.pendingVerification,
  bool stockReserved = false,
  bool stockReleased = false,
  OrderCancelReason? reason,
  DeliveryMethod deliveryMethod = DeliveryMethod.delivery,
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
      installationSelected: false,
      installationFee: 0,
      deliveryFee: 15000,
      totalAmount: 15200,
      deliveryAddress: 'Street 1',
      contactPhone: '0911111111',
      deliveryMethod: deliveryMethod,
      paymentStatus: payment,
      orderStatus: status,
      receiptFileName: 'slip.jpg',
      stockReserved: stockReserved,
      stockReleased: stockReleased,
      cancelReason: reason,
      cancelledAt: reason == null ? null : DateTime(2026, 9, 21, 12, 30),
      createdAt: DateTime(2026, 9, 20, 10),
    );

final _confirmed = _order(payment: PaymentStatus.confirmed, stockReserved: true);

Product _product({int stock = 10}) => Product(
      id: 'p1',
      name: 'Router',
      price: 100,
      companyId: 'c1',
      companyName: 'Nile Tech',
      stockCount: stock,
    );

/// Records what the company's screen asks for; [confirmError] makes the
/// confirmation fail as the data layer would.
class _Orders extends Fake implements OrdersRepository {
  final confirmed = <String>[];
  final cancelled = <(String, OrderCancelReason)>[];
  Object? confirmError;

  @override
  Future<OrderEntity> confirmPayment(String orderId) async {
    if (confirmError != null) throw confirmError!;
    confirmed.add(orderId);
    return _confirmed;
  }

  @override
  Future<void> cancelOrder({
    required String orderId,
    required OrderCancelReason reason,
  }) async {
    cancelled.add((orderId, reason));
  }
}

class _Notifications extends Fake implements NotificationsRepository {
  @override
  Future<void> createNotification(AppNotification notification) async {}
}

/// The customer's order quota is reached when placing the order.
class _QuotaReached extends Fake implements OrdersRepository {
  @override
  Future<OrderEntity> createOrder({
    required String orderId,
    required String customerId,
    required String companyId,
    String companyName = '',
    required String productId,
    required String productName,
    required int quantity,
    required double unitPrice,
    required double productSubtotal,
    required bool installationSelected,
    required double installationFee,
    required double deliveryFee,
    required double totalAmount,
    required String deliveryAddress,
    required String contactPhone,
    DeliveryMethod deliveryMethod = DeliveryMethod.delivery,
    String customerName = '',
    String? receiptFileName,
    double? deliveryLatitude,
    double? deliveryLongitude,
    Object? receipt,
  }) async =>
      throw OrderQuotaReachedException(nextOrderAt: DateTime(2026, 10, 2, 14, 30));
}

Widget _localized(Widget home, {Locale locale = const Locale('en'), List<Override> overrides = const []}) =>
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: locale,
        home: home,
      ),
    );

Widget _companyScreen(
  OrderEntity order, {
  _Orders? orders,
  List<Product>? products,
  Locale locale = const Locale('en'),
}) =>
    _localized(
      CompanyOrderDetailsScreen(companyId: 'c1', orderId: order.id),
      locale: locale,
      overrides: [
        companyOrdersStreamProvider('c1').overrideWith((_) => Stream.value([order])),
        companyTechniciansStreamProvider('c1').overrideWith((_) => Stream.value([])),
        chatConversationProvider(order.id).overrideWith((_) => Stream.value(null)),
        companyProductsStreamProvider('c1')
            .overrideWith((_) => Stream.value(products ?? [_product()])),
        notificationsRepositoryProvider.overrideWithValue(_Notifications()),
        ordersRepositoryProvider.overrideWithValue(orders ?? _Orders()),
      ],
    );

Widget _customerScreen(Widget home, {Locale locale = const Locale('en')}) => _localized(
      home,
      locale: locale,
      overrides: [
        chatConversationProvider('order1234').overrideWith((_) => Stream.value(null)),
      ],
    );

Widget _technicianJob(OrderEntity order, {Locale locale = const Locale('en')}) => _localized(
      Scaffold(body: SingleChildScrollView(child: TechnicianJobStatusActions(order: order))),
      locale: locale,
    );

Future<void> _tall(WidgetTester tester) async {
  tester.view.physicalSize = const Size(900, 3200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Future<void> _tapInDialog(WidgetTester tester, String label) async {
  await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text(label)));
  await tester.pumpAndSettle();
}

void main() {
  // ------------------------------------------------------------- customer
  group('the customer, before the company confirms the payment', () {
    testWidgets('the order is sent, and the product is not reserved yet', (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_customerScreen(OrderPendingVerificationScreen(order: _order())));
      await tester.pumpAndSettle();

      expect(find.text(_en.pendingTitle), findsOneWidget);
      expect(find.text('Order sent: waiting for the company'), findsOneWidget);
      expect(find.textContaining('A receipt is not a confirmed payment'), findsOneWidget);
      expect(find.byKey(const ValueKey('order-not-reserved-yet')), findsOneWidget);
      expect(find.textContaining('The product is not reserved for you yet'), findsOneWidget);
      expect(find.textContaining('return your transfer outside the app'), findsOneWidget);
      expect(find.text('Pending Verification'), findsOneWidget);
    });

    testWidgets('the same in Arabic', (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_customerScreen(
        OrderPendingVerificationScreen(order: _order()),
        locale: const Locale('ar'),
      ));
      await tester.pumpAndSettle();

      expect(find.text('تم إرسال طلبك: بانتظار الشركة'), findsOneWidget);
      expect(find.textContaining('الإيصال ليس تأكيداً للدفع'), findsOneWidget);
      expect(find.textContaining('المنتج غير محجوز لك بعد'), findsOneWidget);
    });

    testWidgets('the order page says the same, not "confirmed"', (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_customerScreen(OrderDetailsScreen(order: _order())));
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('order-not-reserved-yet')), findsOneWidget);
      expect(find.byKey(const ValueKey('order-payment-confirmed-note')), findsNothing);
      // The receipt is shown as attached, never as a confirmed payment.
      expect(find.text('Receipt Attached'), findsOneWidget);
      expect(find.text('Confirmed'), findsNothing);
    });

    testWidgets('the order list says it waits for the company', (tester) async {
      await tester.pumpWidget(_customerScreen(Scaffold(body: OrderCard(order: _order()))));
      await tester.pumpAndSettle();
      expect(find.text(_en.orderAwaitingConfirmation), findsOneWidget);

      await tester.pumpWidget(_customerScreen(Scaffold(body: OrderCard(order: _confirmed))));
      await tester.pumpAndSettle();
      expect(find.text(_en.orderAwaitingConfirmation), findsNothing);
    });
  });

  group('the customer, once the payment is confirmed', () {
    testWidgets('the order page says the payment is confirmed and the product reserved',
        (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_customerScreen(OrderDetailsScreen(order: _confirmed)));
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('order-payment-confirmed-note')), findsOneWidget);
      expect(find.text(_en.orderPaymentConfirmedNote), findsOneWidget);
      expect(find.byKey(const ValueKey('order-not-reserved-yet')), findsNothing);
    });

    testWidgets('an old confirmed order is not shown as expired or overdue', (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_customerScreen(OrderDetailsScreen(order: _confirmed)));
      await tester.pumpAndSettle();
      expect(find.textContaining('24 hours'), findsNothing);
      expect(find.text('Cancelled'), findsNothing);
      expect(_confirmed.isPaymentVerificationOverdue(DateTime(2030)), isFalse);
    });
  });

  group('the customer, a cancelled order', () {
    Future<void> open(WidgetTester tester, OrderEntity order, {Locale locale = const Locale('en')}) async {
      await _tall(tester);
      await tester.pumpWidget(_customerScreen(OrderDetailsScreen(order: order), locale: locale));
      await tester.pumpAndSettle();
    }

    testWidgets('out of stock: why, and that the money comes back, not "by the company"',
        (tester) async {
      await open(tester, _order(status: OrderStatus.cancelled, reason: OrderCancelReason.outOfStock));
      expect(find.text(_en.orderCancelledOutOfStock), findsOneWidget);
      expect(find.textContaining('ran out of stock'), findsOneWidget);
      expect(find.textContaining('returns the transferred money outside the app'), findsOneWidget);
      expect(find.text('Cancelled by the company.'), findsNothing);
      // Said once, in the reason itself.
      expect(find.text(_en.orderCancelledRefundIfPaid), findsNothing);
    });

    testWidgets('out of stock, in Arabic', (tester) async {
      await open(
        tester,
        _order(status: OrderStatus.cancelled, reason: OrderCancelReason.outOfStock),
        locale: const Locale('ar'),
      );
      expect(find.text('أُلغي لأن المنتج نفد قبل تأكيد الدفع. تعيد الشركة المبلغ المحوّل خارج التطبيق.'),
          findsOneWidget);
      expect(find.text('ألغته الشركة.'), findsNothing);
    });

    testWidgets('cancelled after the payment was confirmed: the money comes back outside the app',
        (tester) async {
      await open(tester, _order(
        status: OrderStatus.cancelled,
        payment: PaymentStatus.confirmed,
        stockReserved: true,
        stockReleased: true,
        reason: OrderCancelReason.company,
      ));
      expect(find.text('Cancelled by the company.'), findsOneWidget);
      expect(find.text(_en.orderCancelledRefundConfirmed), findsOneWidget);
      // The customer is not told about the company's stock.
      expect(find.textContaining('back to stock'), findsNothing);
    });

    testWidgets('cancelled before it was confirmed: how to get a transfer back', (tester) async {
      await open(tester, _order(status: OrderStatus.cancelled, reason: OrderCancelReason.expired));
      expect(find.textContaining('not verified within 24 hours'), findsOneWidget);
      expect(find.text(_en.orderCancelledRefundIfPaid), findsOneWidget);
    });
  });

  // -------------------------------------------------------------- company
  group('the company, before the payment is confirmed', () {
    testWidgets('confirming is offered; shipping is not, and the page says why', (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_companyScreen(_order()));
      await tester.pumpAndSettle();

      expect(find.text('Confirm Payment'), findsOneWidget);
      expect(find.textContaining("A receipt is only the customer's claim"), findsOneWidget);
      expect(find.text('Mark Out for Delivery'), findsNothing);
      expect(find.text('Mark Completed'), findsNothing);
      expect(find.byKey(const ValueKey('order-ship-after-payment')), findsOneWidget);
      expect(find.text(_en.adminShipAfterPayment), findsOneWidget);
      // The stock is not taken yet.
      expect(find.text(_en.adminStockNotTaken), findsOneWidget);
      // Enough stock: no warning, no out-of-stock cancellation.
      expect(find.byKey(const ValueKey('order-stock-cannot-cover')), findsNothing);
      expect(find.text(_en.adminCancelOutOfStockButton), findsNothing);
      // It can be cancelled by hand.
      expect(find.text('Cancel order'), findsOneWidget);
    });

    testWidgets('a pickup order cannot be completed before the payment is confirmed either',
        (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_companyScreen(_order(deliveryMethod: DeliveryMethod.pickup)));
      await tester.pumpAndSettle();
      expect(find.text('Mark Completed'), findsNothing);
      expect(find.text(_en.adminShipAfterPayment), findsOneWidget);
    });

    testWidgets('the confirmation says it takes the stock, then confirms', (tester) async {
      await _tall(tester);
      final orders = _Orders();
      await tester.pumpWidget(_companyScreen(_order(), orders: orders));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Confirm Payment'));
      await tester.pumpAndSettle();
      expect(find.textContaining('2 units are taken from stock now'), findsOneWidget);
      await _tapInDialog(tester, 'Confirm');

      expect(orders.confirmed, ['order1234']);
      expect(find.text('Payment confirmed and stock taken.'), findsOneWidget);
    });

    testWidgets('not enough stock: a clear warning and a cancel "out of stock" button',
        (tester) async {
      await _tall(tester);
      final orders = _Orders();
      await tester.pumpWidget(_companyScreen(_order(), orders: orders, products: [_product(stock: 1)]));
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('order-stock-cannot-cover')), findsOneWidget);
      expect(find.text(_en.adminStockCannotCover(1, 2)), findsOneWidget);
      expect(find.textContaining('1 left, 2 needed'), findsOneWidget);

      await tester.tap(find.text(_en.adminCancelOutOfStockButton));
      await tester.pumpAndSettle();
      expect(find.text(_en.adminCancelOutOfStockTitle), findsOneWidget);
      expect(find.textContaining('return 15,200 SDG to them outside the app'), findsOneWidget);
      await _tapInDialog(tester, 'Cancel order');

      expect(orders.cancelled, [('order1234', OrderCancelReason.outOfStock)]);
      expect(find.text(_en.adminOrderCancelledOutOfStock), findsOneWidget);
    });

    testWidgets('a product no longer in the catalogue: said so, and cancel "out of stock"',
        (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_companyScreen(_order(), products: const []));
      await tester.pumpAndSettle();
      expect(find.text(_en.adminProductGoneCannotConfirm), findsOneWidget);
      expect(find.text(_en.adminCancelOutOfStockButton), findsOneWidget);
    });

    testWidgets('the out-of-stock warning in Arabic', (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_companyScreen(
        _order(),
        products: [_product(stock: 1)],
        locale: const Locale('ar'),
      ));
      await tester.pumpAndSettle();
      expect(find.text(_ar.adminStockCannotCover(1, 2)), findsOneWidget);
      expect(find.text('إلغاء لنفاد المخزون'), findsOneWidget);
      expect(find.text(_ar.adminShipAfterPayment), findsOneWidget);
    });

    for (final (label, error, message) in [
      ('already confirmed', const PaymentConfirmationException(PaymentConfirmationIssue.alreadyConfirmed),
          _en.orderPaymentAlreadyConfirmed),
      ('cancelled or moved on', const PaymentConfirmationException(PaymentConfirmationIssue.notAwaitingPayment),
          _en.orderPaymentNotAwaiting),
      ('no receipt', const PaymentConfirmationException(PaymentConfirmationIssue.noReceipt),
          _en.orderPaymentNoReceipt),
      ('not enough stock', const StockUnavailableException(
            message: '', available: 1, requested: 2, issue: StockIssue.insufficient),
          _en.adminStockCannotCover(1, 2)),
      ('the product gone', const StockUnavailableException(message: '', available: 0, requested: 2),
          _en.adminProductGoneCannotConfirm),
    ]) {
      testWidgets('a confirmation refused ($label) says why', (tester) async {
        await _tall(tester);
        final orders = _Orders()..confirmError = error;
        await tester.pumpWidget(_companyScreen(_order(), orders: orders));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Confirm Payment'));
        await tester.pumpAndSettle();
        await _tapInDialog(tester, 'Confirm');
        // The snackbar; the page may show the same words in its own banner.
        expect(find.descendant(of: find.byType(SnackBar), matching: find.text(message)), findsOneWidget);
        expect(orders.confirmed, isEmpty);
      });
    }

    test('"out of stock" refused while the product still covers the order says why', () {
      expect(
        companyOrderErrorMessage(_en, const ProductStillCoversOrderException(available: 5, requested: 2)),
        'The product still has 5 left, enough for this order (2), so it cannot be cancelled '
        'as out of stock. Confirm the payment, or cancel the order by hand.',
      );
    });
  });

  group('the company, once the payment is confirmed', () {
    testWidgets('the order moves on as before, and the stock is shown as taken', (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_companyScreen(_confirmed));
      await tester.pumpAndSettle();

      expect(find.text('Mark Out for Delivery'), findsOneWidget);
      expect(find.text('Confirm Payment'), findsNothing);
      expect(find.byKey(const ValueKey('order-ship-after-payment')), findsNothing);
      expect(find.text(_en.adminStockTaken(2)), findsOneWidget);
      expect(find.text('2 units taken from stock'), findsOneWidget);
      // Out of stock is no reason for a confirmed order.
      expect(find.text(_en.adminCancelOutOfStockButton), findsNothing);
    });

    testWidgets('it can still be cancelled while Processing (Arabic dialog)', (tester) async {
      await _tall(tester);
      final orders = _Orders();
      await tester.pumpWidget(_companyScreen(_confirmed, orders: orders, locale: const Locale('ar')));
      await tester.pumpAndSettle();

      await tester.tap(find.text(_ar.adminCancelOrderButton));
      await tester.pumpAndSettle();
      expect(find.textContaining('دفعه مؤكد'), findsOneWidget);
      expect(find.textContaining('إلى المخزون'), findsOneWidget);
      expect(find.textContaining('خارج التطبيق'), findsOneWidget);
      await _tapInDialog(tester, _ar.adminCancelOrderConfirm);
      expect(orders.cancelled, [('order1234', OrderCancelReason.company)]);
    });

    testWidgets('once Out for Delivery it can no longer be cancelled', (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_companyScreen(_order(
        status: OrderStatus.outForDelivery,
        payment: PaymentStatus.confirmed,
        stockReserved: true,
      )));
      await tester.pumpAndSettle();
      expect(find.text('Cancel order'), findsNothing);
      expect(find.text('Mark Completed'), findsOneWidget);
    });

    testWidgets('its cancellation tells the company to return the money', (tester) async {
      await _tall(tester);
      await tester.pumpWidget(_companyScreen(_order(
        status: OrderStatus.cancelled,
        payment: PaymentStatus.confirmed,
        stockReserved: true,
        stockReleased: true,
        reason: OrderCancelReason.company,
      )));
      await tester.pumpAndSettle();
      expect(find.text('2 units went back to stock.'), findsOneWidget);
      expect(find.text(_en.adminCancelledRefundConfirmed), findsOneWidget);
    });
  });

  // ----------------------------------------------------------- technician
  group('the technician', () {
    testWidgets('before the payment is confirmed: waiting, nothing to move on', (tester) async {
      await tester.pumpWidget(_technicianJob(_order()));
      await tester.pumpAndSettle();
      expect(find.text('Waiting for the company to confirm the payment.'), findsOneWidget);
      expect(find.text(_en.techAwaitingPaymentHint), findsOneWidget);
      expect(find.byKey(const ValueKey('technician-awaiting-payment')), findsOneWidget);
      expect(find.text('Mark Out for Delivery'), findsNothing);
      expect(find.byType(FilledButton), findsNothing);
    });

    testWidgets('the same in Arabic', (tester) async {
      await tester.pumpWidget(_technicianJob(_order(), locale: const Locale('ar')));
      await tester.pumpAndSettle();
      expect(find.text('بانتظار تأكيد الشركة للدفع.'), findsOneWidget);
    });

    testWidgets('once it is confirmed: the job moves on as before', (tester) async {
      await tester.pumpWidget(_technicianJob(_confirmed));
      await tester.pumpAndSettle();
      expect(find.text('Mark Out for Delivery'), findsOneWidget);
      expect(find.byKey(const ValueKey('technician-awaiting-payment')), findsNothing);
    });

    testWidgets('a cancelled job says what happened, not how money is returned', (tester) async {
      await tester.pumpWidget(_technicianJob(_order(
        status: OrderStatus.cancelled,
        payment: PaymentStatus.confirmed,
        reason: OrderCancelReason.company,
      )));
      await tester.pumpAndSettle();
      expect(find.text('This order was cancelled'), findsOneWidget);
      expect(find.text(_en.orderCancelledRefundConfirmed), findsNothing);
      expect(find.text(_en.adminCancelledRefundConfirmed), findsNothing);
    });
  });

  // ---------------------------------------------------------------- quota
  group('five orders in 24 hours', () {
    final reached = OrderQuotaReachedException(nextOrderAt: DateTime(2026, 10, 2, 14, 30));

    test('the customer is told when they may order again', () {
      expect(
        customerOrderErrorMessage(_en, reached),
        'You have placed 5 orders in the last 24 hours, the most allowed. '
        'You can order again after 2026-10-02 14:30.',
      );
      final arabic = customerOrderErrorMessage(_ar, reached);
      expect(arabic, contains('5 طلبات'));
      expect(arabic, contains('2026-10-02 14:30'));
      expect(OrderQuota.ordersPerDay, 5);
    });

    test('without a time, to try again later', () {
      expect(
        customerOrderErrorMessage(_en, const OrderQuotaReachedException()),
        'You have placed 5 orders in the last 24 hours, the most allowed. Please try again later.',
      );
      expect(customerOrderErrorMessage(_ar, const OrderQuotaReachedException()), contains('لاحقاً'));
    });

    test('the order controller shows it, and nothing is placed', () async {
      final container = ProviderContainer(
        overrides: [ordersRepositoryProvider.overrideWithValue(_QuotaReached())],
      );
      addTearDown(container.dispose);
      final placed = await container.read(ordersControllerProvider.notifier).createOrder(
            orderId: 'o6',
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
          );
      expect(placed, isNull);
      final state = container.read(ordersControllerProvider);
      expect(state, isA<OrderActionError>());
      expect((state as OrderActionError).message, customerOrderErrorMessage(_en, reached));
    });
  });

  // --------------------------------------------------------------- labels
  group('labels in both languages', () {
    test('every cancel reason has its own words', () {
      expect(OrderCancelReason.company.label(_en), 'Cancelled by the company.');
      expect(OrderCancelReason.expired.label(_en), contains('24 hours'));
      expect(OrderCancelReason.outOfStock.label(_en), _en.orderCancelledOutOfStock);
      expect(OrderCancelReason.outOfStock.label(_en), isNot(OrderCancelReason.company.label(_en)));
      expect(OrderCancelReason.company.label(_ar), 'ألغته الشركة.');
      expect(OrderCancelReason.outOfStock.label(_ar), contains('نفد'));
      expect(OrderCancelReason.outOfStock.label(_ar), isNot(OrderCancelReason.company.label(_ar)));
    });

    test('a receipt is never called a confirmed payment', () {
      for (final text in [_en.pendingBody, _en.paymentPendingNote, _en.adminVerifyReceipt]) {
        expect(text.toLowerCase(), contains('receipt'));
        expect(text, isNot(contains('Payment will be marked Confirmed')));
      }
      expect(_en.pendingBody, contains('A receipt is not a confirmed payment'));
      expect(_ar.pendingBody, contains('الإيصال ليس تأكيداً للدفع'));
    });

    test('the expiry note no longer says stock goes back, and spares confirmed orders', () {
      expect(_en.adminOrdersExpiryNote, isNot(contains('stock')));
      expect(_en.adminOrdersExpiryNote, contains('a confirmed order never expires'));
      expect(_ar.adminOrdersExpiryNote, contains('الطلب المؤكد'));
    });

    test('plural forms of the new counts in Arabic', () {
      expect(_ar.adminStockTaken(1), contains('وحدة واحدة'));
      expect(_ar.adminStockTaken(2), contains('وحدتان'));
      expect(_ar.adminStockTaken(5), contains('5 وحدات'));
      expect(_en.adminStockTaken(1), '1 unit taken from stock');
      expect(_en.adminConfirmPaymentBody('X1', 1), contains('1 unit is taken from stock now'));
    });
  });
}
