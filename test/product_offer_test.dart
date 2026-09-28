import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/offers/offer_form_screen.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/featured_offers_strip.dart';
import 'package:sudan_it_marketplace/features/products/data/models/product_model.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/repositories/products_repository.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/widgets/product_card.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _en = Locale('en');
const _ar = Locale('ar');

Product _product({
  String id = 'p1',
  double? price = 1000000,
  double? offerPrice,
  DateTime? offerEndsAt,
}) =>
    Product(
      id: id,
      name: 'Laptop $id',
      companyId: 'c1',
      companyName: 'Nile Tech',
      price: price,
      offerPrice: offerPrice,
      offerEndsAt: offerEndsAt,
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

class _RecordingRepository extends Fake implements ProductsRepository {
  final updated = <Product>[];

  @override
  Future<void> updateProduct(Product product) async => updated.add(product);
}

void main() {
  final tomorrow = DateTime.now().add(const Duration(days: 1));
  final yesterday = DateTime.now().subtract(const Duration(days: 1));

  group('offer on a product', () {
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

    test('an offer past its end date is over and the normal price is back', () {
      final product = _product(offerPrice: 850000, offerEndsAt: yesterday);
      expect(product.hasActiveOffer, isFalse);
      expect(product.salePrice, 1000000);
      expect(product.offerDiscountPercent, 0);
    });

    test('an offer not below the normal price, or without one, is ignored', () {
      expect(_product(offerPrice: 1000000).hasActiveOffer, isFalse);
      expect(_product(price: null, offerPrice: 5).hasActiveOffer, isFalse);
      expect(_product(price: null, offerPrice: 5).salePrice, isNull);
    });

    test('withOffer(null) removes the offer and its end date', () {
      final ended = _product(offerPrice: 1, offerEndsAt: tomorrow)
          .withOffer(null, tomorrow);
      expect(ended.offerPrice, isNull);
      expect(ended.offerEndsAt, isNull);
    });

    test('stock changes keep the offer', () {
      final product = _product(offerPrice: 850000).withStockCount(2);
      expect(product.offerPrice, 850000);
    });

    test('the offer is saved and read back', () {
      final ends = DateTime(2026, 10, 15, 23, 59, 59);
      final fields = ProductModel.toFirestoreFields(
        _product(offerPrice: 850000, offerEndsAt: ends),
      );
      expect(fields['offerPrice'], 850000);
      expect((fields['offerEndsAt'] as Timestamp).toDate(), ends);

      final none = ProductModel.toFirestoreFields(_product());
      expect(none.containsKey('offerPrice'), isTrue);
      expect(none['offerPrice'], isNull);
      expect(none['offerEndsAt'], isNull);

      final read = ProductModel.fromFirestore(_FakeSnapshot({
        'name': 'A',
        'price': 100,
        'offerPrice': 80,
        'offerEndsAt': Timestamp.fromDate(ends),
      }));
      expect(read.offerPrice, 80);
      expect(read.offerEndsAt, ends);
    });

    test('products on offer are listed biggest discount first', () {
      final list = productsOnOffer([
        _product(id: 'a', offerPrice: 900000),
        _product(id: 'b'),
        _product(id: 'c', offerPrice: 500000),
        _product(id: 'd', offerPrice: 100, offerEndsAt: yesterday),
      ]);
      expect(list.map((p) => p.id), ['c', 'a']);
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

    testWidgets('the strip is titled in Arabic and hidden with no offers',
        (tester) async {
      await tester.pumpWidget(_app(
        Scaffold(
          body: FeaturedOffersStrip(offers: [_product(offerPrice: 850000)]),
        ),
        locale: _ar,
      ));
      expect(find.text('عروض مميزة'), findsOneWidget);
      expect(find.text('خصم 15%'), findsOneWidget);

      await tester.pumpWidget(_app(
        const Scaffold(body: FeaturedOffersStrip(offers: [])),
      ));
      expect(find.byKey(const ValueKey('featured-offers')), findsNothing);
    });
  });

  group('company sets the offer', () {
    Future<_RecordingRepository> open(WidgetTester tester, Product product) async {
      final repo = _RecordingRepository();
      await tester.pumpWidget(_app(
        OfferFormScreen(product: product),
        overrides: [
          productsRepositoryProvider.overrideWithValue(repo),
          companyProductsStreamProvider
              .overrideWith((ref, id) => Stream.value([product])),
        ],
      ));
      await tester.pumpAndSettle();
      return repo;
    }

    testWidgets('saves an offer below the normal price', (tester) async {
      final repo = await open(tester, _product());
      await tester.enterText(
        find.descendant(
          of: find.byKey(const ValueKey('offer-price')),
          matching: find.byType(EditableText),
        ),
        '850000',
      );
      await tester.pump();
      expect(find.text('15% off'), findsOneWidget);
      await tester.ensureVisible(find.byKey(const ValueKey('offer-save')));
      await tester.tap(find.byKey(const ValueKey('offer-save')));
      await tester.pumpAndSettle();
      expect(repo.updated.single.offerPrice, 850000);
      expect(repo.updated.single.price, 1000000);
    });

    testWidgets('refuses an offer price at or above the normal price',
        (tester) async {
      final repo = await open(tester, _product());
      await tester.enterText(
        find.descendant(
          of: find.byKey(const ValueKey('offer-price')),
          matching: find.byType(EditableText),
        ),
        '1000000',
      );
      await tester.ensureVisible(find.byKey(const ValueKey('offer-save')));
      await tester.tap(find.byKey(const ValueKey('offer-save')));
      await tester.pumpAndSettle();
      expect(
        find.text('The offer price must be lower than the normal price.'),
        findsOneWidget,
      );
      expect(repo.updated, isEmpty);
    });

    testWidgets('ends a running offer', (tester) async {
      final repo = await open(tester, _product(offerPrice: 850000));
      await tester.ensureVisible(find.byKey(const ValueKey('offer-remove')));
      await tester.tap(find.byKey(const ValueKey('offer-remove')));
      await tester.pumpAndSettle();
      expect(repo.updated.single.offerPrice, isNull);
      expect(repo.updated.single.price, 1000000);
    });
  });
}
