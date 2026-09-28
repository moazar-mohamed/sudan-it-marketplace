import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/offers/company_offers_tab.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/offers/offer_form_screen.dart';
import 'package:sudan_it_marketplace/features/company_services/data/models/company_service_model.dart';
import 'package:sudan_it_marketplace/features/company_services/domain/entities/company_service.dart';
import 'package:sudan_it_marketplace/features/company_services/domain/repositories/company_service_repository.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/featured_offers_strip.dart';
import 'package:sudan_it_marketplace/features/offers/domain/offer_item.dart';
import 'package:sudan_it_marketplace/features/offers/domain/offer_pricing.dart';
import 'package:sudan_it_marketplace/features/products/data/models/product_model.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/repositories/products_repository.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/widgets/product_card.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _en = Locale('en');
const _ar = Locale('ar');

Product _product({
  String id = 'p1',
  double? price = 1000000,
  double? offerPrice,
  DateTime? offerEndsAt,
  OfferBadge? badge,
}) =>
    Product(
      id: id,
      name: 'Laptop $id',
      companyId: 'c1',
      companyName: 'Nile Tech',
      price: price,
      offerPrice: offerPrice,
      offerEndsAt: offerEndsAt,
      offerBadge: badge,
    );

CompanyService _link({
  String id = 'c1_s1',
  double? price = 200000,
  double? offerPrice,
  DateTime? offerEndsAt,
}) =>
    CompanyService(
      id: id,
      companyId: 'c1',
      serviceId: 's1',
      isActive: true,
      createdAt: DateTime(2026),
      price: price,
      offerPrice: offerPrice,
      offerEndsAt: offerEndsAt,
    );

final _service = CatalogService(
  id: 's1',
  categoryId: 'cat1',
  name: 'Office network setup',
  description: '',
  isActive: true,
  createdAt: DateTime(2026),
);

Widget _app(Widget home, {Locale locale = _en, List overrides = const []}) {
  return ProviderScope(
    // ignore: argument_type_not_assignable
    overrides: overrides.cast(),
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [_en, _ar],
      home: home,
    ),
  );
}

// ignore: subtype_of_sealed_class
class _FakeSnapshot extends Fake
    implements DocumentSnapshot<Map<String, dynamic>> {
  _FakeSnapshot(this._data);

  final Map<String, dynamic> _data;

  @override
  String get id => 'doc1';

  @override
  Map<String, dynamic>? data() => _data;
}

class _ProductsRepo extends Fake implements ProductsRepository {
  final updated = <Product>[];

  @override
  Future<void> updateProduct(Product product) async => updated.add(product);
}

class _ServicesRepo extends Fake implements CompanyServiceRepository {
  final offers = <Map<String, Object?>>[];

  @override
  Future<void> setCompanyServiceOffer({
    required String companyServiceId,
    double? offerPrice,
    DateTime? offerEndsAt,
    OfferBadge? offerBadge,
  }) async {
    offers.add({
      'id': companyServiceId,
      'offerPrice': offerPrice,
      'offerEndsAt': offerEndsAt,
      'offerBadge': offerBadge,
    });
  }
}

void main() {
  final tomorrow = DateTime.now().add(const Duration(days: 1));
  final yesterday = DateTime.now().subtract(const Duration(days: 1));

  group('offer pricing', () {
    test('a running offer sets what the customer pays and the discount', () {
      final product = _product(offerPrice: 850000, offerEndsAt: tomorrow);
      expect(product.hasActiveOffer, isTrue);
      expect(product.salePrice, 850000);
      expect(product.price, 1000000);
      expect(product.offerDiscountPercent, 15);
    });

    test('an offer with no end date keeps running', () {
      expect(_product(offerPrice: 900000).hasActiveOffer, isTrue);
    });

    test('an offer past its end date has ended and the normal price is back',
        () {
      final product = _product(offerPrice: 850000, offerEndsAt: yesterday);
      expect(product.hasActiveOffer, isFalse);
      expect(product.hasEndedOffer, isTrue);
      expect(product.salePrice, 1000000);
    });

    test('an offer not below the normal price, or without one, is ignored', () {
      expect(_product(offerPrice: 1000000).hasOffer, isFalse);
      expect(_product(price: null, offerPrice: 5).hasActiveOffer, isFalse);
      expect(_product(price: null, offerPrice: 5).salePrice, isNull);
    });

    test('a service offer works the same way', () {
      final link = _link(offerPrice: 150000, offerEndsAt: tomorrow);
      expect(link.hasActiveOffer, isTrue);
      expect(link.salePrice, 150000);
      expect(link.offerDiscountPercent, 25);
      expect(_link(offerPrice: 150000, offerEndsAt: yesterday).salePrice,
          200000);
    });

    test('withOffer(null) removes the offer, its end date and its badge', () {
      final ended = _product(
        offerPrice: 1,
        offerEndsAt: tomorrow,
        badge: OfferBadge.special,
      ).withOffer(null, tomorrow, OfferBadge.special);
      expect(ended.offerPrice, isNull);
      expect(ended.offerEndsAt, isNull);
      expect(ended.offerBadge, isNull);
      expect(_link(offerPrice: 1).withOffer(null, tomorrow).offerPrice, isNull);
    });

    test('stock changes keep the offer', () {
      final product = _product(offerPrice: 850000, badge: OfferBadge.limited)
          .withStockCount(2);
      expect(product.offerPrice, 850000);
      expect(product.offerBadge, OfferBadge.limited);
    });

    test('a product offer is saved and read back', () {
      final ends = DateTime(2026, 10, 15, 23, 59, 59);
      final fields = ProductModel.toFirestoreFields(
        _product(offerPrice: 850000, offerEndsAt: ends, badge: OfferBadge.special),
      );
      expect(fields['offerPrice'], 850000);
      expect((fields['offerEndsAt'] as Timestamp).toDate(), ends);
      expect(fields['offerBadge'], 'special');

      final none = ProductModel.toFirestoreFields(_product());
      expect(none['offerPrice'], isNull);
      expect(none['offerEndsAt'], isNull);
      expect(none['offerBadge'], isNull);

      final read = ProductModel.fromFirestore(_FakeSnapshot({
        'name': 'A',
        'price': 100,
        'offerPrice': 80,
        'offerEndsAt': Timestamp.fromDate(ends),
        'offerBadge': 'limited',
      }));
      expect(read.offerPrice, 80);
      expect(read.offerEndsAt, ends);
      expect(read.offerBadge, OfferBadge.limited);
    });

    test('a service offer is read back, and junk badges are ignored', () {
      final ends = DateTime(2026, 10, 15);
      final link = CompanyServiceModel.fromMap('l1', {
        'price': 200,
        'offerPrice': 150,
        'offerEndsAt': Timestamp.fromDate(ends),
        'offerBadge': 'nonsense',
        'createdAt': DateTime(2026),
      });
      expect(link.offerPrice, 150);
      expect(link.offerEndsAt, ends);
      expect(link.offerBadge, isNull);
    });

    test('running offers mix products and services, biggest discount first',
        () {
      final list = runningOffers([
        ProductOfferItem(_product(id: 'a', offerPrice: 900000)),
        ProductOfferItem(_product(id: 'b')),
        ServiceOfferItem(
          link: _link(offerPrice: 100000),
          service: _service,
          companyName: 'Nile Tech',
        ),
        ProductOfferItem(
          _product(id: 'd', offerPrice: 100, offerEndsAt: yesterday),
        ),
      ]);
      expect(list.map((item) => item.id), ['c1_s1', 'a']);
    });
  });

  group('customer sees the offer', () {
    testWidgets('the card shows the offer price, the old price and the badge',
        (tester) async {
      await tester.pumpWidget(_app(
        Scaffold(body: ProductCard(product: _product(offerPrice: 850000))),
      ));
      expect(find.text('850,000 SDG'), findsOneWidget);
      expect(find.text('1,000,000'), findsOneWidget);
      expect(find.text('15% off'), findsOneWidget);
    });

    testWidgets('a chosen badge replaces the percentage', (tester) async {
      await tester.pumpWidget(_app(
        Scaffold(
          body: ProductCard(
            product: _product(offerPrice: 850000, badge: OfferBadge.special),
          ),
        ),
      ));
      expect(find.text('Special offer'), findsOneWidget);
      expect(find.text('15% off'), findsNothing);
    });

    testWidgets('an ended offer shows only the normal price', (tester) async {
      await tester.pumpWidget(_app(
        Scaffold(
          body: ProductCard(
            product: _product(offerPrice: 850000, offerEndsAt: yesterday),
          ),
        ),
      ));
      expect(find.text('1,000,000 SDG'), findsOneWidget);
      expect(find.textContaining('off'), findsNothing);
    });

    testWidgets('the strip lists products and services, in Arabic',
        (tester) async {
      await tester.pumpWidget(_app(
        Scaffold(
          body: FeaturedOffersStrip(offers: [
            ProductOfferItem(_product(offerPrice: 850000)),
            ServiceOfferItem(
              link: _link(offerPrice: 150000),
              service: _service,
              companyName: 'Nile Tech',
            ),
          ]),
        ),
        locale: _ar,
      ));
      expect(find.text('عروض مميزة'), findsOneWidget);
      expect(find.text('خصم 15%'), findsOneWidget);
      expect(find.text('خصم 25%'), findsOneWidget);
      expect(find.text('Office network setup'), findsOneWidget);
      expect(find.text('خدمة'), findsOneWidget);

      await tester.pumpWidget(_app(
        const Scaffold(body: FeaturedOffersStrip(offers: [])),
      ));
      expect(find.byKey(const ValueKey('featured-offers')), findsNothing);
    });
  });

  group('company sets the offer', () {
    late _ProductsRepo products;
    late _ServicesRepo services;

    Future<void> open(
      WidgetTester tester, {
      OfferItem? initial,
      List<Product>? productList,
    }) async {
      products = _ProductsRepo();
      services = _ServicesRepo();
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_app(
        OfferFormScreen(companyId: 'c1', initial: initial),
        overrides: [
          productsRepositoryProvider.overrideWithValue(products),
          companyServiceRepositoryProvider.overrideWithValue(services),
          companyProductsStreamProvider.overrideWith(
            (ref, id) => Stream.value(productList ?? [_product()]),
          ),
          activeServicesForCompanyProvider
              .overrideWith((ref, id) => Stream.value([_link()])),
          allServicesProvider.overrideWith((ref, id) => Stream.value([_service])),
          companyStreamProvider.overrideWith((ref, id) => Stream.value(null)),
        ],
      ));
      await tester.pumpAndSettle();
    }

    Future<void> type(WidgetTester tester, String text) async {
      await tester.enterText(
        find.descendant(
          of: find.byKey(const ValueKey('offer-value')),
          matching: find.byType(EditableText),
        ),
        text,
      );
      await tester.pump();
    }

    Future<void> tapKey(WidgetTester tester, String key) async {
      await tester.ensureVisible(find.byKey(ValueKey(key)));
      await tester.tap(find.byKey(ValueKey(key)));
      await tester.pumpAndSettle();
    }

    testWidgets('the preview is there before anything is chosen',
        (tester) async {
      await open(tester);
      expect(find.byKey(const ValueKey('offer-preview')), findsOneWidget);
      expect(
        find.text(
          'Choose a product or service to preview the offer as customers will see it.',
        ),
        findsOneWidget,
      );
      await tapKey(tester, 'offer-save');
      expect(
        find.text('Choose a product or service for the offer.'),
        findsOneWidget,
      );
    });

    testWidgets('picks a product and publishes a percentage offer',
        (tester) async {
      await open(tester);
      await tapKey(tester, 'offer-choose');
      await tester.tap(find.byKey(const ValueKey('offer-pick-p1')));
      await tester.pumpAndSettle();
      await type(tester, '15');
      expect(find.text('Offer price: 850,000 SDG'), findsOneWidget);
      // The preview follows what is typed.
      expect(find.text('15% off'), findsOneWidget);
      await tapKey(tester, 'offer-badge-2');
      expect(find.text('Limited time'), findsWidgets);
      await tapKey(tester, 'offer-save');

      final saved = products.updated.single;
      expect(saved.offerPrice, 850000);
      expect(saved.price, 1000000);
      expect(saved.offerBadge, OfferBadge.limited);
      // A week by default.
      expect(
        saved.offerEndsAt!.difference(DateTime.now()).inDays,
        inInclusiveRange(6, 7),
      );
    });

    testWidgets('a product without a price cannot be picked', (tester) async {
      await open(tester, productList: [_product(price: null)]);
      await tapKey(tester, 'offer-choose');
      expect(find.text('No price - set one first'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('offer-pick-p1')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('offer-selected')), findsNothing);
    });

    testWidgets('refuses a new price that is not below the normal one',
        (tester) async {
      await open(tester, initial: ProductOfferItem(_product()));
      await tapKey(tester, 'offer-mode');
      await tester.tap(find.text('New price'));
      await tester.pumpAndSettle();
      await type(tester, '1000000');
      await tapKey(tester, 'offer-save');
      expect(
        find.text('The offer price must be lower than the normal price.'),
        findsOneWidget,
      );
      expect(products.updated, isEmpty);
    });

    testWidgets('puts a service on offer with no end date', (tester) async {
      await open(
        tester,
        initial: ServiceOfferItem(
          link: _link(),
          service: _service,
          companyName: 'Nile Tech',
        ),
      );
      await type(tester, '25');
      await tapKey(tester, 'offer-duration-3');
      await tapKey(tester, 'offer-save');
      final saved = services.offers.single;
      expect(saved['id'], 'c1_s1');
      expect(saved['offerPrice'], 150000);
      expect(saved['offerEndsAt'], isNull);
      expect(saved['offerBadge'], OfferBadge.discount);
    });

    testWidgets('ends a running offer after confirming', (tester) async {
      await open(
        tester,
        initial: ProductOfferItem(_product(offerPrice: 850000)),
        productList: [_product(offerPrice: 850000)],
      );
      expect(find.text('Edit offer'), findsOneWidget);
      await tapKey(tester, 'offer-remove');
      await tester.tap(find.text('End offer').last);
      await tester.pumpAndSettle();
      expect(products.updated.single.offerPrice, isNull);
      expect(products.updated.single.price, 1000000);
    });
  });

  testWidgets('the Offers tab lists running and ended offers', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app(
      const Scaffold(body: CompanyOffersTab(companyId: 'c1')),
      overrides: [
        companyProductsStreamProvider.overrideWith(
          (ref, id) => Stream.value([
            _product(id: 'p1', offerPrice: 850000, offerEndsAt: tomorrow),
            _product(id: 'p2', offerPrice: 700000, offerEndsAt: yesterday),
            _product(id: 'p3'),
          ]),
        ),
        activeServicesForCompanyProvider.overrideWith(
          (ref, id) => Stream.value([_link(offerPrice: 150000)]),
        ),
        allServicesProvider.overrideWith((ref, id) => Stream.value([_service])),
        companyStreamProvider.overrideWith((ref, id) => Stream.value(null)),
      ],
    ));
    await tester.pumpAndSettle();
    expect(find.text('Running (2)'), findsOneWidget);
    expect(find.text('Ended (1)'), findsOneWidget);
    expect(find.byKey(const ValueKey('offer-tile-p1')), findsOneWidget);
    expect(find.byKey(const ValueKey('offer-tile-c1_s1')), findsOneWidget);
    expect(find.byKey(const ValueKey('offer-tile-p2')), findsOneWidget);
    expect(find.byKey(const ValueKey('offer-tile-p3')), findsNothing);
  });
}
