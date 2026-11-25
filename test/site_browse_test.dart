import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_services/data/models/company_service_model.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_browse.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_companies.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/review.dart';
import 'package:sudan_it_marketplace/features/reviews/presentation/reviews_providers.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

/// The app's products, services and companies pages are sictm.net's: the
/// same filters, sorts and layout rules.

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
  _cat('sec', 'Security'),
];

final _now = DateTime.now();

Product _product(
  String id, {
  double? price = 1000,
  double? offerPrice,
  String categoryId = 'net',
  String companyId = 'c1',
  String brand = '',
  bool delivery = true,
  bool installation = false,
  int ageDays = 1,
}) =>
    Product(
      id: id,
      name: 'Item $id',
      price: price,
      offerPrice: offerPrice,
      categoryId: categoryId,
      companyId: companyId,
      companyName: companyId == 'c1' ? 'Alpha' : 'Beta',
      brand: brand,
      inStock: true,
      stockCount: 3,
      isDeliveryAvailable: delivery,
      isInstallationAvailable: installation,
      createdAt: _now.subtract(Duration(days: ageDays)),
    );

final _products = [
  _product('a', price: 300, brand: 'Cisco', ageDays: 3),
  _product('b', price: 100, offerPrice: 80, categoryId: 'wifi', companyId: 'c2', brand: 'TP-Link', ageDays: 1),
  _product('c', price: 200, categoryId: 'sec', delivery: false, installation: true, ageDays: 2),
];

const _c1 = Company(id: 'c1', name: 'Alpha', rating: 4.0, reviewCount: 10);
const _c2 = Company(id: 'c2', name: 'Beta', rating: 4.8, reviewCount: 2);

final _services = [
  CatalogService(id: 's1', categoryId: 'net', name: 'Network Setup', description: '', isActive: true, createdAt: DateTime(2026)),
];
final _links = [
  CompanyServiceModel(id: 'c1_s1', companyId: 'c1', serviceId: 's1', isActive: true, createdAt: DateTime(2026), price: 500),
];

Future<void> _pump(WidgetTester tester, Widget page, {double width = 390, double scale = 1, Locale locale = const Locale('en')}) async {
  tester.view.physicalSize = Size(width, 4000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        marketplaceProductsProvider.overrideWithValue(_products),
        firestoreProductsStreamProvider.overrideWith((ref) => Stream.value(_products)),
        marketplaceCompaniesProvider.overrideWithValue(const [_c1, _c2]),
        firestoreCompaniesStreamProvider.overrideWith((ref) => Stream.value(const [_c1, _c2])),
        allCategoriesProvider.overrideWith((ref) => Stream.value(_categories)),
        activeServicesProvider(null).overrideWith((ref) => Stream.value(_services)),
        allActiveCompanyServicesProvider.overrideWith((ref) => Stream.value(_links)),
        ratingsProvider.overrideWith((ref) => Stream.value(const <String, RatingStats>{})),
      ],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: Scaffold(body: page),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

bool _shown(String id) => find.byKey(ValueKey('site-product-$id')).evaluate().isNotEmpty;

void main() {
  group('the site rules', () {
    test('filters: offers, delivery, installation, brand, company', () {
      final ratings = <String, RatingStats>{};
      List<String> ids(SiteBrowseFilters f) =>
          siteFilterProducts(_products, f, ratings).map((p) => p.id).toList();
      expect(ids(const SiteBrowseFilters(offers: true)), ['b']);
      expect(ids(const SiteBrowseFilters(delivery: true)), ['a', 'b']);
      expect(ids(const SiteBrowseFilters(installation: true)), ['c']);
      expect(ids(const SiteBrowseFilters(brand: 'cisco')), ['a']);
      expect(ids(const SiteBrowseFilters(companyId: 'c2')), ['b']);
      expect(ids(const SiteBrowseFilters(kind: SiteBrowseKind.services)), isEmpty);
    });

    test('services show on their tab only, and not under a product-only filter', () {
      // ignore: prefer_const_constructors
      final services = SiteBrowseFilters(kind: SiteBrowseKind.services);
      expect(siteFilterListings(const [], const SiteBrowseFilters()), isEmpty);
      expect(services.active, isFalse);
      expect(services.copyWith(delivery: true).active, isTrue);
    });

    test('sorts: newest, price both ways (no price last), top rated', () {
      List<String> ids(SiteProductSort s, [Map<String, RatingStats> r = const {}]) =>
          siteSortProducts(_products, s, r).map((p) => p.id).toList();
      expect(ids(SiteProductSort.newest), ['b', 'c', 'a']);
      expect(ids(SiteProductSort.priceLow), ['b', 'c', 'a']);
      expect(ids(SiteProductSort.priceHigh), ['a', 'c', 'b']);
      expect(
        ids(SiteProductSort.topRated, {RatingStats.keyFor('product', 'c'): const RatingStats(sum: 5, count: 1)}),
        ['c', 'a', 'b'],
      );
      final noPrice = [_product('x', price: null), ..._products];
      expect(siteSortProducts(noPrice, SiteProductSort.priceLow, const {}).last.id, 'x');
      expect(siteSortProducts(noPrice, SiteProductSort.priceHigh, const {}).last.id, 'x');
    });

    test('newest puts the companies serving the city first', () {
      final ids = siteSortProducts(_products, SiteProductSort.newest, const {}, serves: (p) => p.companyId == 'c1')
          .map((p) => p.id)
          .toList();
      expect(ids, ['c', 'a', 'b']);
    });

    test('brands once each, A to Z; companies A to Z', () {
      expect(siteBrandsOf([..._products, _product('d', brand: 'cisco ')]), ['Cisco', 'TP-Link']);
      expect(siteCompaniesOf(_products, const []).map((c) => c.$2), ['Alpha', 'Beta']);
    });

    test('companies: by rating, by reviews, by name, serving the city first', () {
      List<String> ids(SiteCompanySort s, {String? city}) =>
          siteViewCompanies(const [_c1, _c2], s, const {}, const {}, null, city).map((c) => c.id).toList();
      expect(ids(SiteCompanySort.topRated), ['c2', 'c1']);
      expect(ids(SiteCompanySort.mostReviewed), ['c1', 'c2']);
      expect(ids(SiteCompanySort.name), ['c1', 'c2']);
      const local = Company(id: 'c3', name: 'Gamma', rating: 1, reviewCount: 0, serviceCityIds: ['kassala']);
      final byCity = siteViewCompanies(const [_c1, local], SiteCompanySort.topRated, const {}, const {}, null, 'khartoum');
      expect(byCity.map((c) => c.id), ['c1', 'c3']);
    });
  });

  group('the products page', () {
    testWidgets('a main category narrows to its tree and shows its sub-categories', (tester) async {
      await _pump(tester, const SiteBrowsePage(kind: SiteBrowseKind.products));
      expect([_shown('a'), _shown('b'), _shown('c')], [true, true, true]);
      await tester.tap(find.byKey(const ValueKey('browse-cat-net')));
      await tester.pumpAndSettle();
      expect([_shown('a'), _shown('b'), _shown('c')], [true, true, false]);
      expect(find.byKey(const ValueKey('browse-sub-wifi')), findsOneWidget);
      await tester.ensureVisible(find.byKey(const ValueKey('browse-sub-wifi')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('browse-sub-wifi')));
      await tester.pumpAndSettle();
      expect([_shown('a'), _shown('b')], [false, true]);
      await tester.tap(find.byKey(const ValueKey('browse-cat-all')));
      await tester.pumpAndSettle();
      expect(_shown('c'), isTrue);
    });

    testWidgets('a filter narrows, shows as a tag, and «Clear all» resets it', (tester) async {
      await _pump(tester, const SiteBrowsePage(kind: SiteBrowseKind.products));
      await tester.tap(find.byKey(const ValueKey('browse-filter-offers')));
      await tester.pumpAndSettle();
      expect([_shown('a'), _shown('b'), _shown('c')], [false, true, false]);
      expect(find.text('Offers ✕'), findsOneWidget);
      expect(find.text('1 product'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('browse-clear-all')));
      await tester.pumpAndSettle();
      expect(_shown('a'), isTrue);
      expect(find.text('3 products'), findsOneWidget);
    });

    testWidgets('the page search keeps the sort and says when nothing matches', (tester) async {
      await _pump(tester, const SiteBrowsePage(kind: SiteBrowseKind.products));
      await tester.enterText(find.byType(TextField), 'zzzz');
      await tester.pumpAndSettle();
      expect(find.text('No results for “zzzz” here.'), findsOneWidget);
      await tester.tap(find.text('Clear filters'));
      await tester.pumpAndSettle();
      expect(_shown('a'), isTrue);
    });

    testWidgets('the list view puts the picture on the side', (tester) async {
      await _pump(tester, const SiteBrowsePage(kind: SiteBrowseKind.products));
      final grid = tester.getSize(find.byKey(const ValueKey('site-product-a'))).height;
      await tester.tap(find.byKey(const ValueKey('browse-view-list')));
      await tester.pumpAndSettle();
      expect(tester.getSize(find.byKey(const ValueKey('site-product-a'))).height, lessThan(grid));
    });

    testWidgets('the services tab lists services only', (tester) async {
      await _pump(tester, const SiteBrowsePage(kind: SiteBrowseKind.services));
      expect(find.byKey(const ValueKey('site-service-s1')), findsOneWidget);
      expect(_shown('a'), isFalse);
      expect(find.byKey(const ValueKey('browse-filter-delivery')), findsNothing);
    });

    for (final (locale, width, scale) in [(const Locale('ar'), 320.0, 1.3), (const Locale('en'), 390.0, 1.0)]) {
      testWidgets('lays out without overflow: ${locale.languageCode} $width x$scale', (tester) async {
        await _pump(tester, const SiteBrowsePage(kind: SiteBrowseKind.products), width: width, scale: scale, locale: locale);
        await tester.tap(find.byKey(const ValueKey('browse-view-list')));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('the companies page', () {
    testWidgets('top rated first; a category chip keeps the companies working in it', (tester) async {
      await _pump(tester, const SiteCompaniesPage());
      double top(String id) => tester.getTopLeft(find.byKey(ValueKey('site-company-$id'))).dy;
      expect(top('c2'), lessThan(top('c1')));
      expect(find.text('2 companies'), findsOneWidget);
      // A chip is as wide as its words, not the whole card (as on the site).
      expect(tester.getSize(find.byKey(const ValueKey('companies-cat-all'))).width, lessThan(150));
      await tester.tap(find.byKey(const ValueKey('companies-cat-sec')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('site-company-c2')), findsNothing);
      expect(find.text('1 company'), findsOneWidget);
    });

    testWidgets('lays out without overflow in Arabic at 320 with large text', (tester) async {
      await _pump(tester, const SiteCompaniesPage(), width: 320, scale: 1.3, locale: const Locale('ar'));
      expect(tester.takeException(), isNull);
    });
  });
}
