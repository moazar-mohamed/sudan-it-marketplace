import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/products/company_product_details_screen.dart';
import 'package:sudan_it_marketplace/features/offers/domain/offer_pricing.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_labels.dart';
import 'package:sudan_it_marketplace/features/products/data/models/product_model.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/product_visibility.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

// ignore: subtype_of_sealed_class
class _FakeSnapshot extends Fake implements DocumentSnapshot<Map<String, dynamic>> {
  _FakeSnapshot(this._data);

  final Map<String, dynamic> _data;

  @override
  String get id => 'doc1';

  @override
  Map<String, dynamic>? data() => _data;
}

Product _product({bool hidden = false, String reason = ''}) => Product(
      id: 'p1',
      name: 'Router',
      price: 100,
      companyId: 'c1',
      stockCount: 5,
      hidden: hidden,
      hiddenReason: reason,
    );

void main() {
  group('a product Platform Admin hid', () {
    test('is read from the document, and a product without the fields is visible', () {
      final hidden = ProductModel.fromFirestore(_FakeSnapshot({
        'name': 'A',
        'price': 100,
        'hidden': true,
        'hiddenReason': 'Counterfeit item',
      }));
      expect(hidden.hidden, isTrue);
      expect(hidden.hiddenReason, 'Counterfeit item');

      final plain = ProductModel.fromFirestore(_FakeSnapshot({'name': 'B', 'price': 100}));
      expect(plain.hidden, isFalse);
      expect(plain.hiddenReason, '');
    });

    test('is never written back by the app, so a company\'s edit leaves it alone', () {
      final fields = ProductModel.toFirestoreFields(_product(hidden: true, reason: 'Fake'));
      expect(fields.containsKey('hidden'), isFalse);
      expect(fields.containsKey('hiddenReason'), isFalse);
    });

    test('stays hidden through the copies the app makes of a product', () {
      final hidden = _product(hidden: true, reason: 'Fake');
      expect(hidden.withStockCount(3).hidden, isTrue);
      expect(hidden.withStockCount(3).hiddenReason, 'Fake');
      expect(hidden.withOffer(80, null, OfferBadge.special).hidden, isTrue);
      expect(hidden.withOffer(80, null, OfferBadge.special).hiddenReason, 'Fake');
    });

    test('is left out of what customers see, and only that', () {
      final visible = withoutHiddenProducts([
        _product(),
        _product(hidden: true, reason: 'Fake'),
      ]);
      expect(visible, hasLength(1));
      expect(visible.single.hidden, isFalse);
      expect(withoutHiddenProducts(const []), isEmpty);
    });

    test('the marketplace stream uses that filter', () {
      final source = File(
        'lib/features/products/data/datasources/firestore_products_remote_data_source.dart',
      ).readAsStringSync();
      expect(source, contains('withoutHiddenProducts('));
    });
  });

  group('an order Platform Admin cancelled', () {
    test('is read from the stored reason', () {
      expect(OrderCancelReason.fromValue('admin'), OrderCancelReason.admin);
      expect(OrderCancelReason.admin.value, 'admin');
      expect(OrderCancelReason.fromValue('nonsense'), isNull);
    });

    test('says the platform cancelled it, in both languages, not the company', () {
      final en = AppLocalizationsEn();
      final ar = AppLocalizationsAr();
      expect(OrderCancelReason.admin.label(en), 'Cancelled by the platform.');
      expect(OrderCancelReason.admin.label(ar), 'ألغته المنصة.');
      expect(
        OrderCancelReason.admin.label(en),
        isNot(OrderCancelReason.company.label(en)),
      );
    });
  });

  group('the company\'s product screen', () {
    Future<void> open(WidgetTester tester, Product product, {Locale locale = const Locale('en')}) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            companyProductsStreamProvider('c1').overrideWith((ref) => Stream.value([product])),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const CompanyProductDetailsScreen(companyId: 'c1', productId: 'p1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('tells the company its product is hidden, and why', (tester) async {
      await open(tester, _product(hidden: true, reason: 'Counterfeit item'));
      expect(find.text('Hidden by the platform'), findsOneWidget);
      expect(find.text('Counterfeit item'), findsOneWidget);
    });

    testWidgets('says so when no reason was recorded', (tester) async {
      await open(tester, _product(hidden: true));
      expect(find.text('No reason was given.'), findsOneWidget);
    });

    testWidgets('shows nothing about it for a visible product', (tester) async {
      await open(tester, _product());
      expect(find.text('Hidden by the platform'), findsNothing);
    });

    testWidgets('in Arabic', (tester) async {
      await open(tester, _product(hidden: true, reason: 'منتج مقلّد'), locale: const Locale('ar'));
      expect(find.text('مخفي من المنصة'), findsOneWidget);
      expect(find.text('منتج مقلّد'), findsOneWidget);
    });
  });
}
