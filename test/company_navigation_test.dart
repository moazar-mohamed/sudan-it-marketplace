import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/company_admin_shell.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/orders/company_orders_tab.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/profile/company_profile_screen.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/technicians/technicians_screen.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/domain/repositories/orders_repository.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/service_requests/domain/entities/service_request.dart';
import 'package:sudan_it_marketplace/features/service_requests/presentation/service_request_providers.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/features/settings/presentation/settings_screen.dart';
import 'package:sudan_it_marketplace/features/technicians/domain/entities/technician.dart';
import 'package:sudan_it_marketplace/features/technicians/presentation/technicians_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _companyId = 'c1';

OrderEntity _order(
  String id,
  String product, {
  DeliveryMethod method = DeliveryMethod.delivery,
  bool installation = false,
  required int day,
}) =>
    OrderEntity(
      id: id,
      customerId: 'cust1',
      companyId: _companyId,
      productId: 'p-$id',
      productName: product,
      quantity: 1,
      unitPrice: 1000,
      productSubtotal: 1000,
      installationSelected: installation,
      installationFee: installation ? 50 : 0,
      deliveryFee: 0,
      totalAmount: 1000,
      deliveryAddress: 'Khartoum',
      deliveryMethod: method,
      contactPhone: '0912345678',
      customerName: 'Amna',
      createdAt: DateTime(2026, 9, day),
    );

final _orders = [
  _order('pick1', 'Pickup Router', method: DeliveryMethod.pickup, day: 1),
  _order('del1', 'Delivered Switch', day: 2),
  _order('inst1', 'Installed Camera', installation: true, day: 3),
  _order(
    'inst2',
    'Picked-up Installed AP',
    method: DeliveryMethod.pickup,
    installation: true,
    day: 4,
  ),
];

final _request = ServiceRequest(
  id: 'req1',
  customerId: 'cust1',
  customerName: 'Amna',
  companyId: _companyId,
  companyName: 'Acme IT',
  companyServiceId: 'cs1',
  serviceId: 's1',
  serviceName: 'Network audit',
  details: 'Office network',
  address: 'Khartoum',
  contactPhone: '0912345678',
  status: ServiceRequestStatus.pending,
  createdAt: DateTime(2026, 9, 5),
);

/// Records when the shell asks for overdue orders to be expired.
class _ExpiryRecorder extends Fake implements OrdersRepository {
  final companies = <String>[];

  @override
  Future<int> expireOverdueOrders(String companyId) async {
    companies.add(companyId);
    return 0;
  }
}

Widget _shell({
  Locale locale = const Locale('en'),
  List<OrderEntity> orders = const [],
  List<ServiceRequest> requests = const [],
  OrdersRepository? ordersRepository,
}) {
  return ProviderScope(
    overrides: [
      if (ordersRepository != null)
        ordersRepositoryProvider.overrideWithValue(ordersRepository),
      companyStreamProvider(_companyId).overrideWith(
        (_) => Stream.value(const Company(
          id: _companyId,
          name: 'Acme IT',
          rating: 0,
          reviewCount: 0,
        )),
      ),
      companyProductsStreamProvider(_companyId)
          .overrideWith((_) => Stream.value(const [])),
      companyOrdersStreamProvider(_companyId)
          .overrideWith((_) => Stream.value(orders)),
      companyTechniciansStreamProvider(_companyId).overrideWith(
        (_) => Stream.value(const [
          Technician(id: 't1', companyId: _companyId, fullName: 'Tech One'),
          Technician(
            id: 't2',
            companyId: _companyId,
            fullName: 'Tech Two',
            isActive: false,
          ),
        ]),
      ),
      companyServiceRequestsStreamProvider(_companyId)
          .overrideWith((_) => Stream.value(requests)),
      companyChatsStreamProvider(_companyId)
          .overrideWith((_) => Stream.value(const [])),
      activeServicesForCompanyProvider(_companyId)
          .overrideWith((_) => Stream.value(const [])),
      allServicesProvider(null).overrideWith((_) => Stream.value(const [])),
      activeServicesProvider(null).overrideWith((_) => Stream.value(const [])),
      allCategoriesProvider.overrideWith((_) => Stream.value(const [])),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: const CompanyAdminShell(companyId: _companyId),
    ),
  );
}

Finder _barItem(String label) => find.descendant(
      of: find.byType(NavigationBar),
      matching: find.text(label),
    );

int _barIndex(WidgetTester tester) =>
    tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex;

Future<void> _selectSection(WidgetTester tester, String label) async {
  final chip = find.descendant(
    of: find.byKey(const ValueKey('company-orders-sections')),
    matching: find.text(label),
  );
  // The chips scroll sideways on a phone.
  await tester.ensureVisible(chip);
  await tester.pumpAndSettle();
  await tester.tap(chip);
  await tester.pumpAndSettle();
}

void main() {
  // A small phone: 360 logical pixels wide.
  void usePhone(WidgetTester tester) {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  testWidgets('the bar is Home, Orders, Catalog, Account and Add, no overflow',
      (tester) async {
    usePhone(tester);
    await tester.pumpWidget(_shell());
    await tester.pumpAndSettle();

    expect(find.byType(NavigationDestination), findsNWidgets(5));
    for (final label in ['Home', 'Orders', 'Catalog', 'Account', 'Add']) {
      expect(_barItem(label), findsOneWidget, reason: label);
    }
    expect(tester.takeException(), isNull);
    // Home is titled with the company's own name.
    expect(find.text('Acme IT'), findsWidgets);
    // Settings sits in the app bar, next to chats and notifications.
    expect(find.byTooltip('Settings'), findsOneWidget);
    expect(find.byTooltip('Chats'), findsOneWidget);
    expect(find.byTooltip('Notifications'), findsOneWidget);
  });

  testWidgets('Add opens one sheet for a product, a service and a technician',
      (tester) async {
    usePhone(tester);
    await tester.pumpWidget(_shell());
    await tester.pumpAndSettle();

    await tester.tap(_barItem('Add'));
    await tester.pumpAndSettle();
    expect(find.text('Add new'), findsOneWidget);
    expect(find.text('Add Product'), findsOneWidget);
    expect(find.text('Add Service'), findsOneWidget);
    expect(find.text('Add Technician'), findsOneWidget);
    // Add is an action, not a tab: the selected tab does not change.
    expect(_barIndex(tester), 0);

    await tester.tap(find.byKey(const ValueKey('company-add-technician')));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsNothing);
    expect(find.text('Add Technician'), findsWidgets, reason: 'the form is open');
  });

  testWidgets('Settings opens from the app bar', (tester) async {
    usePhone(tester);
    await tester.pumpWidget(_shell());
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Settings'));
    await tester.pumpAndSettle();
    expect(find.byType(SettingsScreen), findsOneWidget);
  });

  testWidgets('Account leads to the company profile and the technicians',
      (tester) async {
    usePhone(tester);
    await tester.pumpWidget(_shell());
    await tester.pumpAndSettle();

    await tester.tap(_barItem('Account'));
    await tester.pumpAndSettle();
    expect(_barIndex(tester), 3);
    expect(find.text('View company profile'), findsOneWidget);
    expect(find.text('1 active'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('account-technicians')));
    await tester.pumpAndSettle();
    expect(find.byType(TechniciansScreen), findsOneWidget);
    expect(find.text('Tech One'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('account-company')));
    await tester.pumpAndSettle();
    expect(find.byType(CompanyProfileScreen), findsOneWidget);
    // Signing out stays inside the company profile.
    await tester.scrollUntilVisible(
      find.text('Sign out'),
      300,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Sign out'), findsOneWidget);
  });

  testWidgets('Catalog holds the products and the services', (tester) async {
    usePhone(tester);
    await tester.pumpWidget(_shell());
    await tester.pumpAndSettle();

    await tester.tap(_barItem('Catalog'));
    await tester.pumpAndSettle();
    expect(find.text('Products'), findsOneWidget);
    expect(find.text('Services'), findsOneWidget);
  });

  group('Orders sections', () {
    testWidgets('each order is in one section; services list the requests',
        (tester) async {
      usePhone(tester);
      await tester.pumpWidget(_shell(orders: _orders, requests: [_request]));
      await tester.pumpAndSettle();
      await tester.tap(_barItem('Orders'));
      await tester.pumpAndSettle();

      // All: every order and the service request, newest first.
      expect(find.text('All (5)'), findsOneWidget);
      expect(find.text('Network audit'), findsOneWidget);
      expect(
        tester.getTopLeft(find.text('Network audit')).dy,
        lessThan(tester.getTopLeft(find.text('Picked-up Installed AP')).dy),
      );

      await _selectSection(tester, 'Pickup (1)');
      expect(find.text('Pickup Router'), findsOneWidget);
      expect(find.text('Delivered Switch'), findsNothing);
      expect(find.text('Picked-up Installed AP'), findsNothing,
          reason: 'installation wins over pickup');

      await _selectSection(tester, 'Delivery (1)');
      expect(find.text('Delivered Switch'), findsOneWidget);
      expect(find.text('Installed Camera'), findsNothing);

      await _selectSection(tester, 'Installation (2)');
      expect(find.text('Installed Camera'), findsOneWidget);
      expect(find.text('Picked-up Installed AP'), findsOneWidget);
      expect(find.text('Network audit'), findsNothing);

      await _selectSection(tester, 'Services (1)');
      expect(find.text('Network audit'), findsOneWidget);
      expect(find.text('Installed Camera'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('search looks through orders and service requests',
        (tester) async {
      usePhone(tester);
      await tester.pumpWidget(_shell(orders: _orders, requests: [_request]));
      await tester.pumpAndSettle();
      await tester.tap(_barItem('Orders'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'audit');
      await tester.pumpAndSettle();
      expect(find.text('Network audit'), findsOneWidget);
      expect(find.text('Pickup Router'), findsNothing);
    });

    testWidgets('the dashboard installation tile opens the Installation section',
        (tester) async {
      usePhone(tester);
      await tester.pumpWidget(_shell(orders: _orders));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Installation Jobs'));
      await tester.pumpAndSettle();
      expect(_barIndex(tester), 1);
      final chips = tester.widgetList<ChoiceChip>(find.descendant(
        of: find.byKey(const ValueKey('company-orders-sections')),
        matching: find.byType(ChoiceChip),
      ));
      final selected = chips.firstWhere((chip) => chip.selected);
      expect((selected.label as Text).data, 'Installation (2)');
      expect(sectionOfOrder(_orders[3]), CompanyOrdersSection.installation);
    });
  });

  group('the 24-hour payment verification expiry (no server)', () {
    testWidgets('each opening of the Orders page runs it for this company',
        (tester) async {
      usePhone(tester);
      final recorder = _ExpiryRecorder();
      await tester.pumpWidget(_shell(orders: _orders, ordersRepository: recorder));
      await tester.pumpAndSettle();
      // Not on start: the app opens on Home.
      expect(recorder.companies, isEmpty);

      await tester.tap(_barItem('Orders'));
      await tester.pumpAndSettle();
      expect(recorder.companies, [_companyId]);

      await tester.tap(_barItem('Home'));
      await tester.pumpAndSettle();
      expect(recorder.companies, hasLength(1));

      // Opening Orders from a dashboard tile runs it too.
      await tester.tap(find.text('Installation Jobs'));
      await tester.pumpAndSettle();
      expect(recorder.companies, [_companyId, _companyId]);
    });

    testWidgets('the page says so while payments wait for verification',
        (tester) async {
      usePhone(tester);
      await tester.pumpWidget(_shell(orders: _orders, ordersRepository: _ExpiryRecorder()));
      await tester.pumpAndSettle();
      await tester.tap(_barItem('Orders'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('company-orders-expiry-note')), findsOneWidget);
      expect(find.textContaining('within 24 hours'), findsOneWidget);
      expect(find.textContaining('when you open this page'), findsOneWidget);
    });

    testWidgets('no note once every payment was verified', (tester) async {
      usePhone(tester);
      final verified = [
        for (final order in _orders)
          order.copyWith(paymentStatus: PaymentStatus.confirmed),
      ];
      await tester.pumpWidget(_shell(orders: verified, ordersRepository: _ExpiryRecorder()));
      await tester.pumpAndSettle();
      await tester.tap(_barItem('Orders'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('company-orders-expiry-note')), findsNothing);
    });
  });

  testWidgets('the bar, sections and Add sheet are translated and RTL in Arabic',
      (tester) async {
    usePhone(tester);
    await tester.pumpWidget(
      _shell(locale: const Locale('ar'), orders: _orders, requests: [_request]),
    );
    await tester.pumpAndSettle();

    expect(
      Directionality.of(tester.element(find.byType(NavigationBar))),
      TextDirection.rtl,
    );
    for (final label in ['الرئيسية', 'الطلبات', 'الكتالوج', 'حسابي', 'إضافة']) {
      expect(_barItem(label), findsOneWidget, reason: label);
    }
    await tester.tap(_barItem('الطلبات'));
    await tester.pumpAndSettle();
    for (final label in ['استلام (1)', 'توصيل (1)', 'تركيب (2)', 'خدمات (1)']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }

    await tester.tap(_barItem('إضافة'));
    await tester.pumpAndSettle();
    expect(find.text('إضافة جديد'), findsOneWidget);
    expect(find.text('إضافة خدمة'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
