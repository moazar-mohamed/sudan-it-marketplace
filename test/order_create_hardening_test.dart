import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/utils/text_clip.dart';
import 'package:sudan_it_marketplace/core/widgets/app_widgets.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/auth_user.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_controller.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_state.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/location/presentation/widgets/location_field.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/entities/app_notification.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notifications_providers.dart';
import 'package:sudan_it_marketplace/features/orders/data/datasources/firestore_orders_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/orders/data/models/order_model.dart';
import 'package:sudan_it_marketplace/features/orders/data/repositories/orders_repository_impl.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/domain/order_limits.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/checkout_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/manual_payment_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_controller.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

import 'helpers/fake_firestore.dart';
import 'helpers/receipt_fakes.dart';

/// What the product really is called, and who really sells it.
const _realProduct = 'Router AX3000';
const _realCompany = 'Alpha Tech';

/// What a checkout that was tampered with (or is simply out of date) carries.
const _forgedProduct = 'Gift card 500000 SDG - call +249 900 000 000';
const _forgedCompany = 'Ministry of Finance';

Map<String, dynamic> _product({
  String name = _realProduct,
  String? companyName = _realCompany,
}) =>
    {
      'id': 'p1',
      'companyId': 'c1',
      'companyName': ?companyName,
      'name': name,
      'price': 100.0,
      'currency': 'SDG',
      'stockCount': 10,
      'inStock': true,
      'isDeliveryAvailable': true,
      'isInstallationAvailable': false,
    };

/// The order as checkout hands it over: two units of p1 for delivery.
OrderModel _draft({
  String productName = _realProduct,
  String companyName = _realCompany,
}) =>
    OrderModel(
      id: 'o1',
      customerId: 'cust1',
      companyId: 'c1',
      companyName: companyName,
      productId: 'p1',
      productName: productName,
      quantity: 2,
      unitPrice: 100,
      productSubtotal: 200,
      installationSelected: false,
      installationFee: 0,
      deliveryFee: 15000,
      totalAmount: 15200,
      deliveryAddress: 'Street 15, Khartoum',
      contactPhone: '+249912345678',
      customerName: 'Customer One',
      paymentStatus: PaymentStatus.pendingVerification,
      orderStatus: OrderStatus.processing,
      receiptFileName: 'receipt.jpg',
      createdAt: DateTime(2026),
    );

/// Every text value written by every commit, to look for a leaked name.
Iterable<String> _writtenTexts(FakeFirestore store) => store.commits
    .expand((commit) => commit)
    .expand((write) => write.data.values)
    .whereType<String>();

class _RecordingNotifications extends Fake implements NotificationsRepository {
  final created = <AppNotification>[];

  @override
  Future<void> createNotification(AppNotification notification) async =>
      created.add(notification);
}

class _SignedIn extends AuthController {
  @override
  AuthState build() => const AuthAuthenticated(AuthUser(id: 'cust1'));
}

class _Profile extends ProfileController {
  _Profile(this.fullName);

  final String fullName;

  @override
  Future<UserProfile?> build() async => UserProfile(
        id: 'cust1',
        fullName: fullName,
        email: 'cust1@x.test',
        role: UserRole.customer,
        createdAt: DateTime(2026),
        isActive: true,
      );
}

void main() {
  late FakeFirestore store;
  late FirestoreOrdersRemoteDataSource orders;

  setUp(() {
    store = FakeFirestore();
    orders = FirestoreOrdersRemoteDataSource(firestore: store);
    store.put('products/p1', _product());
  });

  // ------------------------------------------------------------ data source
  group('an order is stored under the names of its product', () {
    test('the ordinary order: nothing renamed, no stock taken, one commit',
        () async {
      final created =
          await orders.createOrder(_draft(), receipt: smallReceipt());

      expect(created, (
        id: 'o1',
        productName: _realProduct,
        companyName: _realCompany,
      ));
      expect(store.commits, hasLength(1));
      expect(
        store.commits.single.map((write) => write.path),
        ['orders/o1', 'order_receipts/o1', 'order_quota/cust1', 'chats/o1'],
      );
      // The stock is taken when the company confirms the payment.
      expect(store.read('products/p1')!['stockCount'], 10);
      expect(store.read('products/p1')!.containsKey('lastOrderId'), isFalse);
      final order = store.read('orders/o1')!;
      expect(order['productName'], _realProduct);
      expect(order['companyName'], _realCompany);
      expect(order['customerName'], 'Customer One');
      expect(order['deliveryAddress'], 'Street 15, Khartoum');
      expect(order['totalAmount'], 15200);
      expect(order['stockReserved'], isFalse);
    });

    test('names made up at checkout are not stored anywhere', () async {
      final created = await orders.createOrder(
        _draft(productName: _forgedProduct, companyName: _forgedCompany),
        receipt: smallReceipt(),
      );

      expect(created.productName, _realProduct);
      expect(created.companyName, _realCompany);
      final order = store.read('orders/o1')!;
      expect(order['productName'], _realProduct);
      expect(order['companyName'], _realCompany);
      final chat = store.read('chats/o1')!;
      expect(chat['productName'], _realProduct);
      expect(chat['companyName'], _realCompany);
      expect(_writtenTexts(store), isNot(contains(_forgedProduct)));
      expect(_writtenTexts(store), isNot(contains(_forgedCompany)));
    });

    test('a product renamed while the customer was paying: the new name',
        () async {
      // Checkout still shows the old name; the company has since renamed it.
      store.put('products/p1', _product(name: 'Router AX3000 v2'));

      final created =
          await orders.createOrder(_draft(), receipt: smallReceipt());

      expect(created.productName, 'Router AX3000 v2');
      expect(store.read('orders/o1')!['productName'], 'Router AX3000 v2');
      expect(store.read('chats/o1')!['productName'], 'Router AX3000 v2');
      expect(_writtenTexts(store), isNot(contains(_realProduct)));
    });

    test('a product with no company name stores an empty one, not a guess',
        () async {
      store.put('products/p1', _product(companyName: null));

      final created = await orders.createOrder(
        _draft(companyName: _forgedCompany),
        receipt: smallReceipt(),
      );

      expect(created.companyName, '');
      expect(store.read('orders/o1')!['companyName'], '');
      expect(store.read('chats/o1')!['companyName'], '');
    });

    test('order, receipt, quota step and conversation together; the product '
        'is not written', () async {
      await orders.createOrder(
        _draft(productName: _forgedProduct),
        receipt: smallReceipt(fileName: 'receipt.jpg'),
      );

      expect(
        store.commits.single.map((write) => write.path),
        ['orders/o1', 'order_receipts/o1', 'order_quota/cust1', 'chats/o1'],
      );
      expect(store.read('order_receipts/o1')!['orderId'], 'o1');
      expect(_writtenTexts(store), isNot(contains(_forgedProduct)));
    });

    test('an answer lost after the commit: the stored names come back',
        () async {
      store.put('products/p1', _product(name: 'Router AX3000 v2'));
      store.acknowledgementLost = 'unavailable';

      final created = await orders.createOrder(
        _draft(productName: _forgedProduct, companyName: _forgedCompany),
        receipt: smallReceipt(),
      );

      expect(created, (
        id: 'o1',
        productName: 'Router AX3000 v2',
        companyName: _realCompany,
      ));
      // Written once: the order is not placed, or counted, twice.
      expect(store.commits, hasLength(1));
      expect(store.read('order_quota/cust1')!['next'], 1);
      expect(store.read('products/p1')!['stockCount'], 10);
    });

    test('an order the rules refuse stores nothing', () async {
      store.rejectCommit =
          (path) => path == 'orders/o1' ? 'permission-denied' : null;

      await expectLater(
        orders.createOrder(_draft(), receipt: smallReceipt()),
        throwsException,
      );

      expect(store.read('orders/o1'), isNull);
      expect(store.read('chats/o1'), isNull);
      expect(store.read('order_receipts/o1'), isNull);
      expect(store.read('order_quota/cust1'), isNull);
      expect(store.read('products/p1')!['stockCount'], 10);
    });
  });

  // ------------------------------------------- repository and notification
  group('what is built from a new order uses the stored names', () {
    test('the order handed back, and its "new order" notification', () async {
      store.put('products/p1', _product(name: 'Router AX3000 v2'));
      final notifications = _RecordingNotifications();
      final container = ProviderContainer(
        overrides: [
          ordersRepositoryProvider
              .overrideWithValue(OrdersRepositoryImpl(orders)),
          notificationsRepositoryProvider.overrideWithValue(notifications),
        ],
      );
      addTearDown(container.dispose);

      final order =
          await container.read(ordersControllerProvider.notifier).createOrder(
                orderId: 'o1',
                customerId: 'cust1',
                companyId: 'c1',
                companyName: _forgedCompany,
                productId: 'p1',
                productName: _forgedProduct,
                quantity: 2,
                unitPrice: 100,
                productSubtotal: 200,
                installationSelected: false,
                installationFee: 0,
                deliveryFee: 15000,
                totalAmount: 15200,
                deliveryAddress: 'Street 15, Khartoum',
                contactPhone: '+249912345678',
                customerName: 'Customer One',
                receipt: smallReceipt(),
              );

      expect(order, isNotNull);
      expect(order!.productName, 'Router AX3000 v2');
      expect(order.companyName, _realCompany);
      final sent = notifications.created.single;
      expect(sent.id, 'o1_new_order');
      expect(sent.recipientId, 'c1');
      // The rules accept a notification only under the order's stored name.
      expect(sent.productName, store.read('orders/o1')!['productName']);
      expect(sent.productName, 'Router AX3000 v2');
    });

    test('the repository passes on what the data source stored', () async {
      final remote = FakeOrdersRemote()
        ..storedProductName = _realProduct
        ..storedCompanyName = _realCompany;

      final order = await OrdersRepositoryImpl(remote).createOrder(
        orderId: 'o1',
        customerId: 'cust1',
        companyId: 'c1',
        companyName: _forgedCompany,
        productId: 'p1',
        productName: _forgedProduct,
        quantity: 1,
        unitPrice: 100,
        productSubtotal: 100,
        installationSelected: false,
        installationFee: 0,
        deliveryFee: 0,
        totalAmount: 100,
        deliveryAddress: 'Khartoum',
        contactPhone: '+249912345678',
      );

      expect(order.productName, _realProduct);
      expect(order.companyName, _realCompany);
    });
  });

  // ------------------------------------------------------------------ limits
  group('a text cut to a length the rules accept', () {
    test('a text within the limit is left alone', () {
      expect(clipToLength('Khartoum', 8), 'Khartoum');
      expect(clipToLength('', 5), '');
    });

    test('a longer one is cut to exactly the limit', () {
      expect(clipToLength('a' * 600, 500), hasLength(500));
      expect(clipToLength('ش' * 600, 500), 'ش' * 500);
    });

    test('a character stored as a pair is never cut in half', () {
      const emoji = '😀'; // two code units
      expect(emoji, hasLength(2));
      expect(clipToLength(emoji * 3, 4), emoji * 2);
      expect(clipToLength(emoji * 3, 5), emoji * 2);
      expect(clipToLength(emoji * 3, 1), '');
    });

    test('nothing fits a limit of zero', () {
      expect(clipToLength('abc', 0), '');
    });
  });

  group('the address field stops at its limit', () {
    Widget host(TextEditingController controller, {int? maxTextLength}) =>
        ProviderScope(
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            locale: const Locale('en'),
            home: Scaffold(
              body: SingleChildScrollView(
                child: LocationField(
                  textController: controller,
                  location: null,
                  onLocationChanged: (_) {},
                  maxTextLength: maxTextLength,
                ),
              ),
            ),
          ),
        );
    final field = find.byKey(const Key('location-text-field'));

    testWidgets('a longer text is cut to the limit', (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      await tester.pumpWidget(host(controller, maxTextLength: 500));

      await tester.enterText(field, 'a' * 500);
      expect(controller.text, hasLength(500));
      await tester.enterText(field, 'b' * 700);
      expect(controller.text, hasLength(500));
    });

    testWidgets('it is measured as the rules measure it, not by what is seen',
        (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      await tester.pumpWidget(host(controller, maxTextLength: 10));

      // Seven letters each carrying a vowel mark: seven characters on screen,
      // fourteen in length.
      await tester.enterText(field, 'بَ' * 7);
      expect(controller.text, 'بَ' * 5);
    });

    testWidgets('without a limit the field takes any length', (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      await tester.pumpWidget(host(controller));

      await tester.enterText(field, 'a' * 700);
      expect(controller.text, hasLength(700));
    });
  });

  // ---------------------------------------------------------------- checkout
  group('checkout hands over an order within the limits', () {
    final addressField = find.byKey(const Key('location-text-field'));

    Future<void> openCheckout(
      WidgetTester tester, {
      required Product product,
      required Company company,
      required String fullName,
    }) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_SignedIn.new),
            profileControllerProvider.overrideWith(() => _Profile(fullName)),
            resolvedCompanyProvider.overrideWith((ref, id) => company),
            companyStreamProvider
                .overrideWith((ref, id) => Stream.value(company)),
          ],
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            locale: const Locale('en'),
            home: CheckoutScreen(product: product, quantity: 1),
          ),
        ),
      );
      // The customer's profile is loaded long before checkout in the app.
      final container = ProviderScope.containerOf(
        tester.element(find.byType(CheckoutScreen)),
      );
      await container.read(profileControllerProvider.future);
      await tester.pump();
    }

    Future<ManualPaymentScreen> confirm(
      WidgetTester tester, {
      required Product product,
      required Company company,
      required String fullName,
      String? typedAddress,
    }) async {
      await openCheckout(
        tester,
        product: product,
        company: company,
        fullName: fullName,
      );
      if (typedAddress != null) {
        await tester.enterText(addressField, typedAddress);
      }
      await tester.enterText(
        find.descendant(
          of: find.byType(PhoneField),
          matching: find.byType(EditableText),
        ),
        '912345678',
      );
      // The confirm button is the last one ("select on the map" comes first).
      await tester.tap(find.byType(AppButton).last);
      await tester.pumpAndSettle();
      return tester.widget<ManualPaymentScreen>(
        find.byType(ManualPaymentScreen),
      );
    }

    const company = Company(id: 'c1', name: _realCompany, rating: 0, reviewCount: 0);

    testWidgets('an ordinary order is handed over exactly as typed',
        (tester) async {
      final payment = await confirm(
        tester,
        product: const Product(
          id: 'p1',
          name: _realProduct,
          price: 100,
          companyId: 'c1',
          companyName: _realCompany,
        ),
        company: company,
        fullName: 'Customer One',
        typedAddress: 'Street 15, Khartoum',
      );

      expect(payment.draft.customerName, 'Customer One');
      expect(payment.draft.deliveryAddress, 'Street 15, Khartoum');
      expect(payment.draft.contactPhone, '+249912345678');
      expect(payment.draft.orderId.length, lessThanOrEqualTo(36));
    });

    testWidgets('checkout says the product is reserved only once the company '
        'confirms the payment (ORD-4)', (tester) async {
      await openCheckout(
        tester,
        product: const Product(
          id: 'p1',
          name: _realProduct,
          price: 100,
          companyId: 'c1',
          companyName: _realCompany,
        ),
        company: company,
        fullName: 'Customer One',
      );
      expect(find.byKey(const ValueKey('checkout-reservation-note')), findsOneWidget);
      expect(
        find.textContaining('only then is the product reserved for you'),
        findsOneWidget,
      );
    });

    testWidgets('a very long profile name is cut to the order limit',
        (tester) async {
      final payment = await confirm(
        tester,
        product: const Product(
          id: 'p1',
          name: _realProduct,
          price: 100,
          companyId: 'c1',
          companyName: _realCompany,
        ),
        company: company,
        fullName: 'ن' * 150,
        typedAddress: 'د' * 600,
      );

      expect(payment.draft.customerName, 'ن' * OrderLimits.customerName);
      expect(payment.draft.deliveryAddress, 'د' * OrderLimits.deliveryAddress);
    });

    testWidgets('the address field itself stops at the limit while typing',
        (tester) async {
      await openCheckout(
        tester,
        product: const Product(
          id: 'p1',
          name: _realProduct,
          price: 100,
          companyId: 'c1',
          companyName: _realCompany,
        ),
        company: company,
        fullName: 'Customer One',
      );

      await tester.enterText(addressField, 'د' * 600);

      final typed = tester.widget<EditableText>(
        find.descendant(of: addressField, matching: find.byType(EditableText)),
      );
      expect(typed.controller.text, hasLength(OrderLimits.deliveryAddress));
    });

    testWidgets('a very long company pickup address is cut to the limit',
        (tester) async {
      final payment = await confirm(
        tester,
        // No delivery: the order is collected from the company.
        product: const Product(
          id: 'p1',
          name: _realProduct,
          price: 100,
          companyId: 'c1',
          companyName: _realCompany,
          isDeliveryAvailable: false,
        ),
        company: Company(
          id: 'c1',
          name: _realCompany,
          rating: 0,
          reviewCount: 0,
          pickupAddress: 'x' * 600,
        ),
        fullName: 'Customer One',
      );

      expect(payment.draft.deliveryMethod, DeliveryMethod.pickup);
      expect(payment.draft.deliveryAddress, hasLength(OrderLimits.deliveryAddress));
      expect(payment.draft.deliveryAddress, startsWith('Pickup: xxx'));
    });
  });
}
