import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_detail_parts.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_orders.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/service_requests/domain/entities/service_request.dart';
import 'package:sudan_it_marketplace/features/service_requests/presentation/service_request_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

/// «طلباتي» is sictm.net's: products or services, the page's search, all /
/// open / finished, and the same cards.

OrderEntity _order(String id, String product, {OrderStatus status = OrderStatus.processing, PaymentStatus payment = PaymentStatus.confirmed}) => OrderEntity(
      id: id,
      customerId: 'u1',
      companyId: 'c1',
      companyName: 'Alpha',
      productId: 'p-$id',
      productName: product,
      quantity: 1,
      unitPrice: 1000,
      productSubtotal: 1000,
      installationSelected: false,
      installationFee: 0,
      deliveryFee: 15000,
      totalAmount: 16000,
      deliveryAddress: 'Street 1',
      contactPhone: '+249912345678',
      orderStatus: status,
      paymentStatus: payment,
      createdAt: DateTime(2026, 11, 1),
    );

ServiceRequest _request(String id, String service, ServiceRequestStatus status) => ServiceRequest(
      id: id,
      customerId: 'u1',
      customerName: 'Sara',
      companyId: 'c1',
      companyName: 'Alpha',
      companyServiceId: 'c1_s1',
      serviceId: 's1',
      serviceName: service,
      details: 'Fix it',
      address: '',
      contactPhone: '+249912345678',
      status: status,
      createdAt: DateTime(2026, 11, 2),
      price: 5000,
    );

final _orders = [
  _order('order0001', 'Dell Laptop'),
  _order('order0002', 'Cisco Router', status: OrderStatus.completed),
  _order('order0003', 'HP Printer', payment: PaymentStatus.pendingVerification),
];
final _requests = [
  _request('req00001', 'Network Setup', ServiceRequestStatus.pending),
  _request('req00002', 'Camera Install', ServiceRequestStatus.completed),
];

Future<void> _pump(WidgetTester tester, {List<OrderEntity>? orders, List<ServiceRequest>? requests, double width = 390, double scale = 1, Locale locale = const Locale('en')}) async {
  tester.view.physicalSize = Size(width, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        customerOrdersStreamProvider.overrideWith((ref) => Stream.value(orders ?? _orders)),
        customerServiceRequestsStreamProvider.overrideWith((ref) => Stream.value(requests ?? _requests)),
      ],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: const Scaffold(body: SiteOrdersPage()),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

bool _shown(String key) => find.byKey(ValueKey(key)).evaluate().isNotEmpty;

void main() {
  group('the site rules', () {
    test('open and finished, as the site splits them', () {
      List<String> ids(SiteOrdersFilter f) => siteNarrowOrders(_orders, f, '').map((o) => o.id).toList();
      expect(ids(SiteOrdersFilter.all), ['order0001', 'order0002', 'order0003']);
      expect(ids(SiteOrdersFilter.active), ['order0001', 'order0003']);
      expect(ids(SiteOrdersFilter.done), ['order0002']);
      expect(siteNarrowRequests(_requests, SiteOrdersFilter.done, '').map((r) => r.id), ['req00002']);
    });

    test('the search finds by product, company or number, and keeps the order', () {
      expect(siteNarrowOrders(_orders, SiteOrdersFilter.all, 'router').map((o) => o.id), ['order0002']);
      expect(siteNarrowOrders(_orders, SiteOrdersFilter.all, 'printer').map((o) => o.id), ['order0003']);
      expect(siteNarrowRequests(_requests, SiteOrdersFilter.all, 'camera').map((r) => r.id), ['req00002']);
    });

    test('the site\'s status colours', () {
      expect(siteOrderTone(OrderStatus.outForDelivery), SiteTone.warn);
      expect(siteRequestTone(ServiceRequestStatus.inProgress), SiteTone.info);
      expect(siteRequestTone(ServiceRequestStatus.cancelled), SiteTone.off);
    });
  });

  group('the page', () {
    testWidgets('products first, with the counts on both sides', (tester) async {
      await _pump(tester);
      expect(find.text('My Orders'), findsWidgets);
      expect(find.text('Products (3)'), findsOneWidget);
      expect(find.text('Services (2)'), findsOneWidget);
      expect(_shown('site-order-order0001'), isTrue);
      expect(_shown('site-request-req00001'), isFalse);
      // A receipt still being checked says so on the card.
      expect(find.text('Waiting for the company to confirm your payment'), findsOneWidget);
    });

    testWidgets('the chips keep open or finished orders', (tester) async {
      await _pump(tester);
      await tester.tap(find.byKey(const ValueKey('orders-filter-done')));
      await tester.pumpAndSettle();
      expect(_shown('site-order-order0002'), isTrue);
      expect(_shown('site-order-order0001'), isFalse);
    });

    testWidgets('services: the request cards with their date and price', (tester) async {
      await _pump(tester);
      await tester.tap(find.text('Services (2)'));
      await tester.pumpAndSettle();
      expect(_shown('site-request-req00001'), isTrue);
      expect(find.text('Service request #req00001'), findsOneWidget);
      expect(find.text('2 November 2026'), findsWidgets);
      expect(find.text('5,000 SDG'), findsNWidgets(2));
    });

    testWidgets('a search with nothing found says so', (tester) async {
      await _pump(tester);
      await tester.enterText(find.byType(TextField), 'zzzz');
      await tester.pumpAndSettle();
      expect(find.text('No results for “zzzz” here.'), findsOneWidget);
    });

    testWidgets('no orders at all: the empty state', (tester) async {
      await _pump(tester, orders: const [], requests: const []);
      expect(find.text('No Orders Yet'), findsOneWidget);
    });

    for (final locale in const [Locale('en'), Locale('ar')]) {
      testWidgets('fits a 320 px phone with large text (${locale.languageCode})', (tester) async {
        await _pump(tester, width: 320, scale: 1.6, locale: locale);
        expect(tester.takeException(), isNull);
      });
    }
  });

  testWidgets('a date as the site writes it, in both languages', (tester) async {
    late String en;
    late String ar;
    Widget probe(Locale locale, void Function(String) out) => MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(builder: (context) {
            out(siteLongDate(context, DateTime(2026, 11, 15, 12)));
            return const SizedBox();
          }),
        );
    await tester.pumpWidget(probe(const Locale('en'), (s) => en = s));
    await tester.pumpWidget(probe(const Locale('ar'), (s) => ar = s));
    expect(en, '15 November 2026');
    expect(ar, contains('15'));
    expect(ar, contains('2026'));
  });
}
