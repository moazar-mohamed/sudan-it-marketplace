import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/companies/data/models/company_model.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/orders/company_order_details_screen.dart';
import 'package:sudan_it_marketplace/features/location/data/location_service.dart';
import 'package:sudan_it_marketplace/features/location/domain/geo_location.dart';
import 'package:sudan_it_marketplace/features/location/presentation/widgets/location_field.dart';
import 'package:sudan_it_marketplace/features/location/presentation/widgets/open_location_button.dart';
import 'package:sudan_it_marketplace/features/orders/data/models/order_model.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/widgets/order_location_widgets.dart';
import 'package:sudan_it_marketplace/features/technician/presentation/jobs/technician_job_details_screen.dart';

class _FakeLocationService extends LocationService {
  const _FakeLocationService(this.result);
  final CurrentLocationResult result;

  @override
  Future<CurrentLocationResult> currentLocation() async => result;
}

Widget _app(
  Widget home, {
  Locale locale = const Locale('en'),
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: home,
    ),
  );
}

OrderEntity _order({
  String id = 'order-1',
  DeliveryMethod method = DeliveryMethod.delivery,
  String address = 'Customer street 5',
  double? lat,
  double? lng,
}) {
  return OrderEntity(
    id: id,
    customerId: 'cust-1',
    customerName: 'Sara',
    companyId: 'company-1',
    productId: 'p1',
    productName: 'Router',
    quantity: 1,
    unitPrice: 100,
    productSubtotal: 100,
    installationSelected: true,
    installationFee: 10,
    deliveryFee: 5,
    totalAmount: 115,
    deliveryAddress: address,
    contactPhone: '0911111111',
    deliveryMethod: method,
    technicianId: 't1',
    technicianName: 'Tech',
    deliveryLatitude: lat,
    deliveryLongitude: lng,
    createdAt: DateTime(2026, 1, 1),
  );
}

void main() {
  group('GeoLocation', () {
    test('accepts numeric values and keeps them as numbers', () {
      final point = GeoLocation.tryCreate(15.5, 32);
      expect(point, const GeoLocation(15.5, 32.0));
      expect(point!.latitude, isA<double>());
    });

    test('never treats strings as coordinates', () {
      expect(GeoLocation.tryCreate('15.5', '32.5'), isNull);
    });

    test('needs both values inside the valid range', () {
      expect(GeoLocation.tryCreate(15.5, null), isNull);
      expect(GeoLocation.tryCreate(91, 10), isNull);
      expect(GeoLocation.tryCreate(10, -181), isNull);
      expect(GeoLocation.tryCreate(double.nan, 10), isNull);
      expect(GeoLocation.tryCreate(-90, 180), isNotNull);
    });

    test('formats with six decimals', () {
      expect(const GeoLocation(1.5, 2).latitudeText, '1.500000');
    });
  });

  group('company location data', () {
    test('a legacy company with only text keeps working', () {
      final company = CompanyModel.fromMap('c1', {
        'name': 'Legacy',
        'address': '  Street 1 ',
      });
      expect(company.hasCoordinates, isFalse);
      expect(company.coordinates, isNull);
      expect(company.locationText, 'Street 1');
    });

    test('reads numeric coordinates and ignores string ones', () {
      final withPoint = CompanyModel.fromMap('c1', {
        'name': 'A',
        'address': '',
        'latitude': 15.5,
        'longitude': 32,
      });
      expect(withPoint.coordinates, const GeoLocation(15.5, 32));
      // Coordinates only: the text stays empty (null), not invented.
      expect(withPoint.locationText, isNull);

      final bad = CompanyModel.fromMap('c2', {
        'name': 'B',
        'latitude': '15.5',
        'longitude': '32.5',
      });
      expect(bad.coordinates, isNull);
    });

    test('editing saves numbers next to the text and can remove the point', () {
      const base = Company(
        id: 'c1',
        name: 'A',
        rating: 0,
        reviewCount: 0,
        address: 'Street',
      );
      final both = base.copyWith(
        address: 'Street',
        coordinates: const GeoLocation(15.5, 32.5),
      );
      final saved = CompanyModel.toEditableFields(both);
      expect(saved['address'], 'Street');
      expect(saved['latitude'], 15.5);
      expect(saved['longitude'], 32.5);

      final cleared = both.copyWith(clearCoordinates: true);
      final removed = CompanyModel.toEditableFields(cleared);
      expect(removed['latitude'], isA<FieldValue>());
      expect(removed['address'], 'Street');
    });

    test('an unrelated edit keeps the existing point', () {
      const base = Company(
        id: 'c1',
        name: 'A',
        rating: 0,
        reviewCount: 0,
        latitude: 15.5,
        longitude: 32.5,
      );
      expect(
        base.copyWith(name: 'B').coordinates,
        const GeoLocation(15.5, 32.5),
      );
    });
  });

  group('order delivery location data', () {
    Map<String, dynamic> raw({
      Object? lat,
      Object? lng,
      String address = 'x',
    }) => {
      'customerId': 'c',
      'companyId': 'co',
      'productId': 'p',
      'productName': 'P',
      'deliveryAddress': address,
      'contactPhone': '1',
      'deliveryLatitude': ?lat,
      'deliveryLongitude': ?lng,
    };

    test('a legacy order without coordinates still loads', () {
      final order = OrderModel.fromMap(raw(), 'o1').toEntity();
      expect(order.deliveryCoordinates, isNull);
      expect(order.deliveryText, 'x');
    });

    test('saved coordinates are read back and never replaced', () {
      final order = OrderModel.fromMap(
        raw(lat: 15.6, lng: 32.6),
        'o1',
      ).toEntity();
      expect(order.deliveryCoordinates, const GeoLocation(15.6, 32.6));
    });

    test(
      'create map stores numeric coordinates only when a point was chosen',
      () {
        final withPoint = OrderModel.fromMap(
          raw(lat: 15.6, lng: 32.6),
          'o1',
        ).toFirestoreCreateMap();
        expect(withPoint['deliveryLatitude'], 15.6);
        expect(withPoint['deliveryLongitude'], 32.6);
        expect(withPoint['deliveryLatitude'], isA<double>());

        final textOnly = OrderModel.fromMap(raw(), 'o2').toFirestoreCreateMap();
        expect(textOnly.containsKey('deliveryLatitude'), isFalse);
        expect(textOnly.containsKey('deliveryLongitude'), isFalse);
      },
    );

    test('a map-only order has no address text but keeps its point', () {
      final order = OrderModel.fromMap(
        raw(lat: 1, lng: 2, address: ''),
        'o1',
      ).toEntity();
      expect(order.deliveryText, isNull);
      expect(order.hasDeliveryCoordinates, isTrue);
    });
  });

  group('LocationField (text AND map)', () {
    Widget host(
      TextEditingController controller,
      LocationService service, {
      Locale locale = const Locale('en'),
    }) {
      GeoLocation? value;
      return _app(
        Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => SingleChildScrollView(
              child: LocationField(
                textController: controller,
                location: value,
                onLocationChanged: (v) => setState(() => value = v),
              ),
            ),
          ),
        ),
        locale: locale,
        overrides: [locationServiceProvider.overrideWithValue(service)],
      );
    }

    testWidgets('shows both methods, and text works without the map', (
      tester,
    ) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        host(
          controller,
          const _FakeLocationService(
            CurrentLocationResult.failed(CurrentLocationFailure.denied),
          ),
        ),
      );

      expect(find.text('Location'), findsOneWidget);
      expect(find.byKey(const Key('location-text-field')), findsOneWidget);
      expect(find.text('OR'), findsOneWidget);
      expect(find.text('Select on Map'), findsOneWidget);

      await tester.enterText(
        find.byKey(const Key('location-text-field')),
        'Omdurman, street 4',
      );
      expect(controller.text, 'Omdurman, street 4');
    });

    testWidgets('a denied permission never breaks the form or the picker', (
      tester,
    ) async {
      final controller = TextEditingController(text: 'Typed address');
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        host(
          controller,
          const _FakeLocationService(
            CurrentLocationResult.failed(CurrentLocationFailure.denied),
          ),
        ),
      );

      await tester.tap(find.byKey(const Key('location-select-on-map')));
      await tester.pumpAndSettle();
      expect(find.text('Use My Current Location'), findsOneWidget);

      await tester.tap(find.text('Use My Current Location'));
      await tester.pumpAndSettle();
      expect(find.textContaining('permission was denied'), findsOneWidget);
      // Nothing selected, so Confirm stays disabled, but nothing crashed.
      expect(find.text('Confirm Location'), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(controller.text, 'Typed address');
      expect(find.text('Select on Map'), findsOneWidget);
    });

    testWidgets('choosing a point keeps the typed text and shows lat/lng', (
      tester,
    ) async {
      final controller = TextEditingController(text: 'Typed address');
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        host(
          controller,
          const _FakeLocationService(
            CurrentLocationResult.found(GeoLocation(15.6, 32.6)),
          ),
        ),
      );

      await tester.tap(find.byKey(const Key('location-select-on-map')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Use My Current Location'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirm Location'));
      await tester.pumpAndSettle();

      expect(find.text('Location selected'), findsOneWidget);
      expect(find.text('15.600000'), findsOneWidget);
      expect(find.text('32.600000'), findsOneWidget);
      expect(find.text('Change Location'), findsOneWidget);
      expect(controller.text, 'Typed address');

      await tester.tap(find.byKey(const Key('location-remove')));
      await tester.pump();
      expect(find.text('Select on Map'), findsOneWidget);
      expect(controller.text, 'Typed address');
    });

    testWidgets('Arabic labels render right-to-left', (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        host(
          controller,
          const _FakeLocationService(
            CurrentLocationResult.failed(CurrentLocationFailure.denied),
          ),
          locale: const Locale('ar'),
        ),
      );

      expect(find.text('الموقع'), findsOneWidget);
      expect(find.text('أو'), findsOneWidget);
      expect(find.text('تحديد من الخريطة'), findsOneWidget);
      expect(find.text('أدخل العنوان'), findsOneWidget);
      expect(
        Directionality.of(tester.element(find.text('الموقع'))),
        TextDirection.rtl,
      );
    });
  });

  group('company location display', () {
    testWidgets('coordinates -> View on Map; text only -> no map action', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          const Scaffold(
            body: Column(
              children: [
                CompanyLocationBlock(
                  text: 'Riyadh street',
                  coordinates: GeoLocation(15.5, 32.5),
                  actionLabel: 'View on Map',
                  viewerTitle: 'A',
                ),
                CompanyLocationBlock(
                  text: 'Legacy text only',
                  coordinates: null,
                  actionLabel: 'View on Map',
                  viewerTitle: 'B',
                ),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Riyadh street'), findsOneWidget);
      expect(find.text('Legacy text only'), findsOneWidget);
      expect(find.text('View on Map'), findsOneWidget); // only the first one
      expect(find.byKey(const Key('open-location-search')), findsNothing);
    });
  });

  group('order location buttons', () {
    testWidgets('delivery with a saved point opens exact coordinates', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          Scaffold(
            body: OrderLocationButton(
              order: _order(lat: 15.6, lng: 32.6),
              label: 'Open Order Location',
            ),
          ),
        ),
      );
      expect(find.byKey(const Key('open-location-exact')), findsOneWidget);
      expect(find.byKey(const Key('open-location-search')), findsNothing);
    });

    testWidgets('text-only orders are a labelled search, not a GPS point', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          Scaffold(
            body: OrderLocationButton(
              order: _order(),
              label: 'Open Order Location',
            ),
          ),
        ),
      );
      expect(find.byKey(const Key('open-location-exact')), findsNothing);
      expect(find.byKey(const Key('open-location-search')), findsOneWidget);
      expect(find.textContaining('no exact map point'), findsOneWidget);
    });

    testWidgets('pickup orders show no customer location button', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          Scaffold(
            body: OrderLocationButton(
              order: _order(
                method: DeliveryMethod.pickup,
                address: 'Pickup: x',
              ),
              label: 'Open Order Location',
            ),
          ),
        ),
      );
      expect(find.byType(OutlinedButton), findsNothing);
    });
  });

  group('technician installation order', () {
    Widget screen(OrderEntity order) => _app(
      const TechnicianJobDetailsScreen(technicianId: 't1', orderId: 'order-1'),
      overrides: [
        technicianOrdersStreamProvider('t1')
            .overrideWith((ref) => Stream.value([order])),
      ],
    );

    testWidgets('shows the ORDER location and never the company location', (
      tester,
    ) async {
      await tester.pumpWidget(screen(_order(lat: 15.6, lng: 32.6)));
      await tester.pumpAndSettle();

      expect(find.text('Customer street 5'), findsOneWidget);
      expect(find.text('Open Order Location'), findsOneWidget);
      expect(find.text('Open Company Location'), findsNothing);
      expect(find.text('View Company Location'), findsNothing);
      expect(find.text('Open Delivery Location'), findsNothing);
    });

    testWidgets('a text-only order shows its address and no company button', (
      tester,
    ) async {
      await tester.pumpWidget(screen(_order()));
      await tester.pumpAndSettle();

      expect(find.text('Customer street 5'), findsOneWidget);
      expect(find.text('Open Order Location'), findsOneWidget);
      expect(find.byKey(const Key('open-location-exact')), findsNothing);
      expect(find.text('Open Company Location'), findsNothing);
    });

    testWidgets('a map-only order shows a pinned note instead of blank text', (
      tester,
    ) async {
      await tester.pumpWidget(
        screen(_order(address: '', lat: 15.6, lng: 32.6)),
      );
      await tester.pumpAndSettle();

      expect(find.text('Pinned on map'), findsOneWidget);
      expect(find.text('Open Order Location'), findsOneWidget);
    });
  });

  group('company admin order details', () {
    testWidgets('delivery order: Open Delivery Location, no company location', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          const CompanyOrderDetailsScreen(
            companyId: 'company-1',
            orderId: 'order-1',
          ),
          overrides: [
            companyOrdersStreamProvider('company-1').overrideWith(
              (ref) => Stream.value([_order(lat: 15.6, lng: 32.6)]),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Open Delivery Location'),
        300,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('Open Delivery Location'), findsOneWidget);
      expect(find.text('Open Company Location'), findsNothing);
    });
  });
}
