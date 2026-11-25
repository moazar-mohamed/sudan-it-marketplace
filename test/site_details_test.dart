import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sudan_it_marketplace/core/localization/locale_controller.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_controller.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_state.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_compare.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_detail_parts.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/product_details_screen.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/review.dart';
import 'package:sudan_it_marketplace/features/reviews/presentation/reviews_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

/// The product page and the comparison are sictm.net's: the same order of
/// blocks, the same limits and the same table.

Category _cat(String id, String en, {String? parent}) => Category(
      id: id,
      name: en,
      nameEn: en,
      nameAr: en,
      description: '',
      iconName: '',
      isActive: true,
      createdAt: DateTime(2026),
      parentId: parent,
      sortOrder: null,
    );

final _categories = [
  _cat('net', 'Networks'),
  _cat('wifi', 'WiFi gear', parent: 'net'),
];

Product _product(String id, {double? price = 1000, Map<String, String> specs = const {}, bool installation = false}) => Product(
      id: id,
      name: 'Item $id',
      price: price,
      categoryId: 'wifi',
      companyId: 'c1',
      companyName: 'Alpha',
      brand: 'Cisco',
      inStock: true,
      stockCount: 3,
      isInstallationAvailable: installation,
      installationPrice: installation ? 5000 : null,
      specifications: specs,
      description: 'A long description of a very good router for the office.',
    );

final _products = [
  _product('a', price: 300, specs: const {'Ports': '4'}, installation: true),
  _product('b', price: 100, specs: const {'Speed': '1 Gbps'}),
  _product('c', price: null),
  _product('d', price: 500),
];

const _c1 = Company(id: 'c1', name: 'Alpha', rating: 4.0, reviewCount: 10);

/// A visitor: the page is browsed signed out, without Firebase.
class _Visitor extends AuthController {
  @override
  AuthState build() => const AuthUnauthenticated();
}

Future<ProviderContainer> _pump(
  WidgetTester tester,
  Widget page, {
  double width = 390,
  double scale = 1,
  Locale locale = const Locale('en'),
  List<String> compare = const [],
  bool companiesLoaded = true,
}) async {
  SharedPreferences.setMockInitialValues({
    if (compare.isNotEmpty) 'compare-products': '["${compare.join('","')}"]',
  });
  final prefs = await SharedPreferences.getInstance();
  tester.view.physicalSize = Size(width, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      authControllerProvider.overrideWith(_Visitor.new),
      // Until the companies load, the marketplace list is empty.
      marketplaceProductsProvider.overrideWithValue(companiesLoaded ? _products : const []),
      firestoreProductsStreamProvider.overrideWith((ref) => Stream.value(_products)),
      marketplaceCompaniesProvider.overrideWithValue(const [_c1]),
      firestoreCompaniesStreamProvider.overrideWith(
        (ref) => companiesLoaded ? Stream.value(const [_c1]) : const Stream<List<Company>>.empty(),
      ),
      resolvedCompanyProvider.overrideWith((ref, id) => id == 'c1' ? _c1 : null),
      companyStreamProvider.overrideWith((ref, id) => Stream.value(id == 'c1' ? _c1 : null)),
      allCategoriesProvider.overrideWith((ref) => Stream.value(_categories)),
      ratingsProvider.overrideWith((ref) => Stream.value(const <String, RatingStats>{})),
      targetReviewsProvider.overrideWith((ref, id) => Stream.value(const <Review>[])),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: page,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

void main() {
  group('the site rules', () {
    test('specification names keep the order they first appear', () {
      expect(siteSpecNames(_products), ['Ports', 'Speed']);
    });

    test('the cheapest of the prices that exist', () {
      expect(siteCheapest([300, null, 100, 500]), 100);
      expect(siteCheapest([null, null]), isNull);
    });

    test('a review is dated as the site dates it', () {
      expect(siteIsoDate(DateTime(2026, 3, 7)), '2026-03-07');
    });
  });

  group('the comparison', () {
    testWidgets('holds up to three products and says so on the fourth', (tester) async {
      final container = await _pump(tester, const Scaffold(body: SizedBox()));
      final compare = container.read(siteCompareProvider.notifier);
      expect(compare.toggle('a'), isTrue);
      expect(compare.toggle('b'), isTrue);
      expect(compare.toggle('c'), isTrue);
      expect(compare.toggle('d'), isFalse);
      expect(container.read(siteCompareProvider), ['a', 'b', 'c']);
      // Pressing a picked one takes it out; the list is kept on the device.
      expect(compare.toggle('b'), isTrue);
      expect(container.read(siteCompareProvider), ['a', 'c']);
      expect(container.read(sharedPreferencesProvider)!.getString('compare-products'), '["a","c"]');
    });

    testWidgets('the bar asks for a second product, then compares', (tester) async {
      await _pump(tester, const Scaffold(bottomNavigationBar: SiteCompareBar()), compare: ['a']);
      expect(find.text('1/3'), findsOneWidget);
      // A bar at the bottom, never a sheet over the page.
      expect(tester.getSize(find.byKey(const ValueKey('compare-bar'))).height, lessThan(100));
      expect(find.text('Pick another product'), findsOneWidget);
      expect(tester.widget<FilledButton>(find.byKey(const ValueKey('compare-go'))).onPressed, isNull);

      await _pump(tester, const Scaffold(bottomNavigationBar: SiteCompareBar()), compare: ['a', 'b']);
      expect(find.text('2/3'), findsOneWidget);
      await tester.tap(find.text('Compare now'));
      await tester.pumpAndSettle();
      expect(find.byType(SiteComparePage), findsOneWidget);
    });

    testWidgets('nothing leaves the comparison while the companies are still loading', (tester) async {
      final container = await _pump(
        tester,
        const Scaffold(bottomNavigationBar: SiteCompareBar()),
        compare: ['a', 'b'],
        companiesLoaded: false,
      );
      await tester.pump();
      expect(container.read(siteCompareProvider), ['a', 'b']);
    });

    testWidgets('a product no longer on sale leaves the comparison', (tester) async {
      final container = await _pump(tester, const Scaffold(bottomNavigationBar: SiteCompareBar()), compare: ['a', 'gone']);
      await tester.pump();
      expect(container.read(siteCompareProvider), ['a']);
    });

    testWidgets('✕ clears it and the bar goes', (tester) async {
      await _pump(tester, const Scaffold(bottomNavigationBar: SiteCompareBar()), compare: ['a', 'b']);
      await tester.tap(find.byKey(const ValueKey('compare-clear')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('compare-bar')), findsNothing);
    });

    testWidgets('the table: green on the cheapest, every specification, «—» where missing', (tester) async {
      await _pump(tester, const SiteComparePage(), compare: ['a', 'b', 'c']);
      expect(find.byKey(const ValueKey('compare-table')), findsOneWidget);
      expect(find.text('Ports'), findsOneWidget);
      expect(find.text('Speed'), findsOneWidget);
      expect(find.text('—'), findsWidgets);
      expect(find.text('Contact for the price'), findsOneWidget);
      final cheapest = tester.widget<Text>(find.text('100 SDG'));
      final other = tester.widget<Text>(find.text('300 SDG'));
      expect(cheapest.style?.color, isNot(other.style?.color));
      expect(tester.takeException(), isNull);
    });

    testWidgets('fewer than two products: an empty state', (tester) async {
      await _pump(tester, const SiteComparePage(), compare: ['a']);
      expect(find.text('Comparison'), findsOneWidget);
      expect(find.byKey(const ValueKey('compare-table')), findsNothing);
    });
  });

  group('the product page', () {
    testWidgets('the site\'s order: path, stock, name, compare and share, price, seller, note', (tester) async {
      await _pump(tester, ProductDetailsScreen(product: _products.first));
      double top(Finder f) => tester.getTopLeft(f.first).dy;
      final crumbs = top(find.text('All categories'));
      final stock = top(find.text('In Stock (3)'));
      // The path's last step is the name too: the title is the second one.
      final name = tester.getTopLeft(find.text('Item a').last).dy;
      final compare = top(find.text('Add to comparison'));
      final price = top(find.text('300 SDG'));
      final seller = top(find.text('Alpha'));
      final note = top(find.textContaining('Installation price'));
      final description = top(find.text('Description'));
      final specs = top(find.text('Specifications'));
      expect([crumbs, stock, name, compare, price, seller, note, description, specs], orderedEquals([crumbs, stock, name, compare, price, seller, note, description, specs]..sort()));
      expect(find.text('Networks'), findsWidgets);
      expect(find.text('Share'), findsOneWidget);
    });

    testWidgets('«أضف للمقارنة» adds it and turns to «إزالة من المقارنة»', (tester) async {
      final container = await _pump(tester, ProductDetailsScreen(product: _products.first));
      await tester.tap(find.byKey(const ValueKey('compare-toggle')));
      await tester.pumpAndSettle();
      expect(container.read(siteCompareProvider), ['a']);
      expect(find.text('Remove from comparison'), findsOneWidget);
    });

    testWidgets('a path step asks the shop for that category', (tester) async {
      final container = await _pump(tester, ProductDetailsScreen(product: _products.first));
      await tester.tap(find.text('Networks').first);
      await tester.pumpAndSettle();
      final request = container.read(siteShopRequestProvider);
      expect(request?.categoryId, 'net');
      expect(request?.services, isFalse);
    });

    for (final locale in const [Locale('en'), Locale('ar')]) {
      testWidgets('fits a 320 px phone with large text (${locale.languageCode})', (tester) async {
        await _pump(tester, ProductDetailsScreen(product: _products.first), width: 320, scale: 1.6, locale: locale);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('the comparison table fits a 320 px phone with large text', (tester) async {
      await _pump(tester, const SiteComparePage(), compare: ['a', 'b'], width: 320, scale: 1.6);
      expect(tester.takeException(), isNull);
    });
  });
}
