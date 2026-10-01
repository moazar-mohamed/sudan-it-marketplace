import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/domain/category_tree.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_services/data/models/company_service_model.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/category_grid.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/category_grid_style.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/dashboard_home_tab.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_company_view.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_product_view.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_service_view.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/offer_countdown.dart';
import 'package:sudan_it_marketplace/features/offers/domain/offer_pricing.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/widgets/product_grid_card.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/review.dart';
import 'package:sudan_it_marketplace/features/reviews/presentation/reviews_providers.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_details_screen.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

final _now = DateTime(2026, 10, 1, 12);

Category _cat(String id, String en, String ar, String icon, {String? parent}) =>
    Category(
      id: id,
      name: en,
      nameEn: en,
      nameAr: ar,
      description: '',
      iconName: icon,
      isActive: true,
      createdAt: DateTime(2026),
      parentId: parent,
      sortOrder: null,
    );

final _categories = [
  _cat('net', 'Networks', 'الشبكات', 'network'),
  _cat('sec', 'Security', 'الأمن', 'security'),
  _cat('lap', 'Laptops', 'اللابتوبات', 'laptop'),
  _cat('wifi', 'Wi-Fi', 'واي فاي', 'wifi', parent: 'net'),
];

Product _product(
  String id,
  String name, {
  double? price = 1000,
  double? offerPrice,
  DateTime? offerEndsAt,
  OfferBadge? badge,
  String? categoryId,
  String companyId = 'c1',
  bool delivery = true,
  bool installation = false,
  DateTime? createdAt,
}) => Product(
  id: id,
  name: name,
  price: price,
  offerPrice: offerPrice,
  offerEndsAt: offerEndsAt,
  offerBadge: badge,
  categoryId: categoryId,
  companyId: companyId,
  companyName: 'Co',
  isDeliveryAvailable: delivery,
  isInstallationAvailable: installation,
  createdAt: createdAt,
);

CompanyServiceModel _link(
  String companyId,
  String serviceId, {
  double? price,
  double? offerPrice,
}) => CompanyServiceModel(
  id: '${companyId}_$serviceId',
  companyId: companyId,
  serviceId: serviceId,
  isActive: true,
  createdAt: DateTime(2026),
  price: price,
  offerPrice: offerPrice,
);

CatalogService _service(
  String id,
  String name,
  String categoryId, [
  String about = '',
]) => CatalogService(
  id: id,
  categoryId: categoryId,
  name: name,
  description: about,
  isActive: true,
  createdAt: DateTime(2026),
);

const _c1 = Company(
  id: 'c1',
  name: 'Alpha Systems',
  rating: 4.0,
  reviewCount: 10,
);
const _c2 = Company(
  id: 'c2',
  name: 'Beta Networks',
  rating: 4.8,
  reviewCount: 31,
);
const _c3 = Company(id: 'c3', name: 'Gamma Tech', rating: 4.6, reviewCount: 5);

void main() {
  // The real font, so text is as wide as on a phone. The test font makes every
  // letter a full square and would report overflows that never happen.
  setUpAll(() async {
    final cairo = FontLoader('Cairo');
    for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      cairo.addFont(rootBundle.load('assets/fonts/Cairo-$weight.ttf'));
    }
    await cairo.load();
  });

  group('sorting and filtering the products', () {
    final cheap = _product(
      'a',
      'Cheap',
      price: 100,
      createdAt: DateTime(2026, 9, 1),
    );
    final dear = _product(
      'b',
      'Dear',
      price: 900,
      createdAt: DateTime(2026, 9, 20),
    );
    final unpriced = _product(
      'c',
      'Unpriced',
      price: null,
      createdAt: DateTime(2026, 9, 30),
    );
    final offer = _product(
      'd',
      'Offer',
      price: 500,
      offerPrice: 400,
      installation: true,
      delivery: false,
    );
    final all = [cheap, dear, unpriced, offer];
    const ratings = {
      'product_a': RatingStats(sum: 45, count: 10),
      'product_b': RatingStats(sum: 15, count: 5),
    };

    List<String> ids(List<Product> products) => [
      for (final p in products) p.id,
    ];

    test('newest first, a product without a date last', () {
      final shown = viewProducts(
        all,
        sort: ProductSort.newest,
        filters: const ProductFilters(),
      );
      expect(ids(shown), ['c', 'b', 'a', 'd']);
    });

    test('by price either way, never putting "price on request" first', () {
      expect(
        ids(
          viewProducts(
            all,
            sort: ProductSort.priceLow,
            filters: const ProductFilters(),
          ),
        ),
        ['a', 'd', 'b', 'c'],
      );
      expect(
        ids(
          viewProducts(
            all,
            sort: ProductSort.priceHigh,
            filters: const ProductFilters(),
          ),
        ),
        ['b', 'd', 'a', 'c'],
      );
    });

    test('an offer is sorted by what it costs now, not its normal price', () {
      final shown = viewProducts(
        [dear, offer],
        sort: ProductSort.priceLow,
        filters: const ProductFilters(),
      );
      expect(ids(shown), ['d', 'b']);
    });

    test('top rated: the best average first, then the most ratings', () {
      final shown = viewProducts(
        all,
        sort: ProductSort.topRated,
        filters: const ProductFilters(),
        ratings: ratings,
      );
      expect(ids(shown).take(2), ['a', 'b']);
      // The unrated ones keep the order they came in.
      expect(ids(shown).skip(2), ['c', 'd']);
    });

    test('each chip narrows the list, and they combine', () {
      List<String> only(ProductFilters f) => ids(
        viewProducts(
          all,
          sort: ProductSort.newest,
          filters: f,
          ratings: ratings,
        ),
      );
      expect(only(const ProductFilters(offers: true)), ['d']);
      expect(only(const ProductFilters(delivery: true)), ['c', 'b', 'a']);
      expect(only(const ProductFilters(installation: true)), ['d']);
      expect(only(const ProductFilters(topRated: true)), ['a']);
      expect(only(const ProductFilters(offers: true, delivery: true)), isEmpty);
      expect(const ProductFilters().isActive, isFalse);
      expect(const ProductFilters(offers: true).isActive, isTrue);
    });

    test('an offer that has ended is not an offer', () {
      final ended = _product(
        'e',
        'Ended',
        price: 500,
        offerPrice: 400,
        offerEndsAt: DateTime.now().subtract(const Duration(days: 1)),
      );
      expect(
        viewProducts(
          [ended],
          sort: ProductSort.newest,
          filters: const ProductFilters(offers: true),
        ),
        isEmpty,
      );
    });
  });

  group('recently added', () {
    test('new for two weeks, listed for a month, newest first', () {
      final fresh = _product(
        'f',
        'Fresh',
        createdAt: _now.subtract(const Duration(days: 2)),
      );
      final older = _product(
        'o',
        'Older',
        createdAt: _now.subtract(const Duration(days: 20)),
      );
      final old = _product(
        'x',
        'Old',
        createdAt: _now.subtract(const Duration(days: 90)),
      );
      final undated = _product('u', 'Undated');
      expect(isNewProduct(fresh, _now), isTrue);
      expect(isNewProduct(older, _now), isFalse);
      expect(isNewProduct(undated, _now), isFalse);
      expect(
        [
          for (final p in recentProducts([old, older, undated, fresh], _now))
            p.id,
        ],
        ['f', 'o'],
      );
      expect(recentProducts([fresh, older], _now, limit: 1), [fresh]);
    });
  });

  group('services with what companies ask for them', () {
    final services = [
      _service('s1', 'Network Installation', 'net'),
      _service('s2', 'CCTV', 'sec'),
      _service('s3', 'Unwanted', 'lap'),
    ];
    final links = [
      _link('c1', 's1', price: 50000, offerPrice: 40000),
      _link('c2', 's1', price: 45000),
      _link('c2', 's2'),
      _link('ghost', 's3', price: 1),
    ];

    test('the cheapest company leads, and the offer price counts', () {
      final listing = buildServiceListings(
        services: services,
        links: links,
        companies: const [_c1, _c2],
      ).firstWhere((l) => l.service.id == 's1');
      expect(listing.lead!.companyId, 'c1');
      expect(listing.startsFrom, 40000);
      expect(listing.bestDiscount, 20);
      expect(listing.leadCompany!.name, 'Alpha Systems');
      expect(listing.otherCompanies, 1);
    });

    test('most performed first; services nobody performs stay, last', () {
      final listings = buildServiceListings(
        services: services,
        links: links,
        companies: const [_c1, _c2],
      );
      expect([for (final l in listings) l.service.id], ['s1', 's2', 's3']);
      // "ghost" is not a company customers can see, so s3 has no offers.
      expect(listings.last.offers, isEmpty);
      expect(listings.last.startsFrom, isNull);
      expect(listings.last.leadCompany, isNull);
    });

    test('an offer without a price goes after the priced ones', () {
      final listing = buildServiceListings(
        services: [services.first],
        links: [_link('c1', 's1'), _link('c2', 's1', price: 45000)],
        companies: const [_c1, _c2],
      ).single;
      expect(listing.lead!.companyId, 'c2');
      expect(listing.startsFrom, 45000);
    });
  });

  group('the companies tab logic', () {
    final tree = CategoryTree(_categories);
    final products = [
      _product('p1', 'A', categoryId: 'wifi', companyId: 'c1'),
      _product('p2', 'B', categoryId: 'lap', companyId: 'c1'),
      _product('p3', 'C', categoryId: 'sec', companyId: 'c2'),
    ];
    final links = [_link('c3', 's1')];
    final services = [_service('s1', 'Install', 'net')];

    final topCategories = companyTopCategories(
      tree: tree,
      products: products,
      links: links,
      services: services,
    );

    test('categories come from what a company sells and performs', () {
      // Wi-Fi sits under Networks, so the company is a Networks company.
      expect(topCategories['c1'], ['lap', 'net']);
      expect(topCategories['c2'], ['sec']);
      expect(topCategories['c3'], ['net']);
      expect(topCategories.containsKey('c4'), isFalse);
    });

    test('a chip keeps the companies of its category', () {
      final shown = viewCompanies(
        const [_c1, _c2, _c3],
        sort: CompanySort.topRated,
        ratings: const {},
        categoriesOf: topCategories,
        categoryId: 'net',
      );
      expect([for (final c in shown) c.id], ['c3', 'c1']);
    });

    test('ordered by rating, name or number of reviews', () {
      List<String> order(
        CompanySort sort, [
        Map<String, RatingStats> ratings = const {},
      ]) => [
        for (final c in viewCompanies(
          const [_c1, _c2, _c3],
          sort: sort,
          ratings: ratings,
          categoriesOf: topCategories,
        ))
          c.id,
      ];
      expect(order(CompanySort.topRated), ['c2', 'c3', 'c1']);
      expect(order(CompanySort.name), ['c1', 'c2', 'c3']);
      expect(order(CompanySort.mostReviewed), ['c2', 'c1', 'c3']);
      // Live ratings beat the figures stored on the company.
      expect(
        order(CompanySort.topRated, {
          RatingStats.companyKey('c1'): const RatingStats(sum: 99, count: 20),
        }),
        ['c1', 'c2', 'c3'],
      );
    });
  });

  group('the offers countdown', () {
    Future<void> pumpCountdown(WidgetTester tester, Duration left) async {
      final base = DateTime(2026, 10, 1, 12);
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: OfferCountdown(endsAt: base.add(left), now: () => base),
          ),
        ),
      );
    }

    testWidgets('under a day it shows hours, minutes and seconds', (
      tester,
    ) async {
      await pumpCountdown(
        tester,
        const Duration(hours: 18, minutes: 42, seconds: 5),
      );
      expect(find.text('Ends in'), findsOneWidget);
      expect(find.text('18'), findsOneWidget);
      expect(find.text('42'), findsOneWidget);
      expect(find.text('05'), findsOneWidget);
    });

    testWidgets('further away it says how many days', (tester) async {
      await pumpCountdown(tester, const Duration(days: 3, hours: 4));
      expect(find.text('Ends in 3 days'), findsOneWidget);
      await pumpCountdown(tester, const Duration(days: 1, minutes: 1));
      expect(find.text('Ends in 1 day'), findsOneWidget);
    });

    testWidgets('once the time is up it shows nothing', (tester) async {
      await pumpCountdown(tester, const Duration(seconds: -1));
      expect(find.byKey(const ValueKey('offers-countdown')), findsNothing);
    });

    testWidgets('ticks every second, and stops when it is removed', (
      tester,
    ) async {
      var clock = DateTime(2026, 10, 1, 12);
      final end = clock.add(const Duration(minutes: 1, seconds: 2));
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: OfferCountdown(endsAt: end, now: () => clock),
          ),
        ),
      );
      expect(find.text('02'), findsOneWidget);
      clock = clock.add(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('01'), findsNWidgets(2));
      // Removing it cancels the timer (the test would fail with one pending).
      await tester.pumpWidget(const SizedBox());
    });
  });

  group('the category row', () {
    Widget app(Widget child, {Locale locale = const Locale('en')}) =>
        MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: SingleChildScrollView(child: child)),
        );

    final many = [
      for (var i = 1; i <= 8; i++) _cat('c$i', 'Category $i', 'فئة $i', ''),
    ];

    testWidgets('one sideways row with a title and "View all"', (tester) async {
      String? picked = 'none';
      await tester.pumpWidget(
        app(
          CategoryGrid(
            categories: many,
            selectedId: null,
            style: CategoryGridStyle.homeRow,
            title: 'Shop by category',
            horizontalPadding: 16,
            onSelected: (id) => picked = id,
          ),
        ),
      );
      expect(find.text('Shop by category'), findsOneWidget);
      expect(find.byKey(const ValueKey('categories-view-all')), findsOneWidget);
      // It is a row, not the three-column cards.
      expect(find.text('More'), findsNothing);
      await tester.tap(find.text('Category 1'));
      expect(picked, 'c1');
    });

    testWidgets('"View all" opens every category, and choosing one picks it', (
      tester,
    ) async {
      String? picked;
      await tester.pumpWidget(
        app(
          CategoryGrid(
            categories: many,
            selectedId: null,
            style: CategoryGridStyle.homeRow,
            onSelected: (id) => picked = id,
          ),
        ),
      );
      await tester.tap(find.byKey(const ValueKey('categories-view-all')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Category 8').last);
      await tester.pumpAndSettle();
      expect(picked, 'c8');
    });

    testWidgets('a few categories need no "View all"', (tester) async {
      await tester.pumpWidget(
        app(
          CategoryGrid(
            categories: many.take(3).toList(),
            selectedId: null,
            style: CategoryGridStyle.homeRow,
            onSelected: (_) {},
          ),
        ),
      );
      expect(find.byKey(const ValueKey('categories-view-all')), findsNothing);
    });
  });

  group('the home screen', () {
    // A product on offer (ends in three days), a recent one, an old one and one
    // without a price, across three categories.
    final products = [
      _product(
        'p1',
        'Alpha Router',
        price: 250000,
        offerPrice: 199000,
        offerEndsAt: DateTime.now().add(const Duration(days: 3)),
        badge: OfferBadge.limited,
        categoryId: 'net',
        companyId: 'c2',
        installation: true,
        createdAt: DateTime.now().subtract(const Duration(days: 40)),
      ),
      _product(
        'p2',
        'Beta Laptop',
        price: 385000,
        categoryId: 'lap',
        companyId: 'c1',
        delivery: false,
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
      _product(
        'p3',
        'Gamma Camera',
        price: null,
        categoryId: 'sec',
        companyId: 'c3',
      ),
    ];
    final services = [
      _service('s1', 'Network Setup', 'net', 'Cabling for offices.'),
      _service('s2', 'Camera Install', 'sec'),
    ];
    final links = [
      _link('c1', 's1', price: 50000, offerPrice: 40000),
      _link('c2', 's1', price: 45000),
    ];
    const companies = [_c1, _c2, _c3];

    Future<void> pumpHome(
      WidgetTester tester, {
      Locale locale = const Locale('en'),
      double width = 390,
      double height = 6000,
      double textScale = 1,
    }) async {
      tester.view.physicalSize = Size(width, height);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            marketplaceProductsProvider.overrideWithValue(products),
            marketplaceCompaniesProvider.overrideWithValue(companies),
            firestoreCompaniesStreamProvider.overrideWith(
              (ref) => Stream.value(companies),
            ),
            allCategoriesProvider.overrideWith(
              (ref) => Stream.value(_categories),
            ),
            activeServicesProvider(null)
                .overrideWith((ref) => Stream.value(services)),
            allActiveCompanyServicesProvider.overrideWith(
              (ref) => Stream.value(links),
            ),
            companiesOfferingServiceProvider('s1')
                .overrideWith((ref) => Stream.value([links.first])),
            ratingsProvider.overrideWith(
              (ref) => Stream.value(const <String, RatingStats>{}),
            ),
          ],
          child: MaterialApp(
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(textScaler: TextScaler.linear(textScale)),
              child: child!,
            ),
            home: const Scaffold(body: DashboardHomeTab()),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    Finder within(String key, Finder matching) =>
        find.descendant(of: find.byKey(ValueKey(key)), matching: matching);

    List<String> gridOrder(WidgetTester tester) => [
      for (final card in tester.widgetList<ProductGridCard>(
        find.byType(ProductGridCard),
      ))
        card.product.id,
    ];

    testWidgets(
      'products: the best offer on top, then the sections of the design',
      (tester) async {
        await pumpHome(tester);
        // The hero card, the trust strip, and the featured offers with a countdown.
        expect(within('home-hero', find.text('Alpha Router')), findsOneWidget);
        expect(within('home-hero', find.text('Limited time')), findsOneWidget);
        expect(find.byKey(const ValueKey('home-trust-strip')), findsOneWidget);
        expect(find.byKey(const ValueKey('featured-offers')), findsOneWidget);
        expect(find.byKey(const ValueKey('offers-countdown')), findsOneWidget);
        // The verified companies, best rated first.
        expect(
          within('home-verified-companies', find.text('Beta Networks')),
          findsOneWidget,
        );
        expect(
          within('home-verified-companies', find.text('Alpha Systems')),
          findsOneWidget,
        );
        // Recently added: the two-day-old product only.
        expect(within('home-recent', find.text('Beta Laptop')), findsOneWidget);
        expect(within('home-recent', find.text('Alpha Router')), findsNothing);
        // All products as a grid, newest first.
        expect(find.text('All products'), findsOneWidget);
        expect(gridOrder(tester), ['p2', 'p1', 'p3']);
      },
    );

    testWidgets(
      'products: a price on request says so, and the offer shows both prices',
      (tester) async {
        await pumpHome(tester);
        final grid = find.byKey(const ValueKey('home-products-grid'));
        expect(
          find.descendant(of: grid, matching: find.text('Price on request')),
          findsOneWidget,
        );
        expect(
          find.descendant(
            of: grid,
            matching: find.textContaining('199,000', findRichText: true),
          ),
          findsOneWidget,
        );
        expect(
          find.descendant(of: grid, matching: find.text('250,000')),
          findsOneWidget,
        );
        expect(
          find.descendant(of: grid, matching: find.text('Limited time')),
          findsOneWidget,
        );
        // The recent product is badged "New" in the grid too.
        expect(
          find.descendant(of: grid, matching: find.text('New')),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'products: the chips narrow the grid, and tell when nothing matches',
      (tester) async {
        // Wide enough for every chip (on a phone the row scrolls sideways).
        await pumpHome(tester, width: 900);
        final controls = find.byKey(const ValueKey('home-product-controls'));
        await tester.tap(
          find.descendant(of: controls, matching: find.text('Offers')),
        );
        await tester.pumpAndSettle();
        expect(gridOrder(tester), ['p1']);

        await tester.tap(
          find.descendant(of: controls, matching: find.text('Delivery')),
        );
        await tester.pumpAndSettle();
        expect(gridOrder(tester), ['p1']);

        await tester.tap(
          find.descendant(of: controls, matching: find.text('Top rated')),
        );
        await tester.pumpAndSettle();
        expect(gridOrder(tester), isEmpty);
        expect(find.text('No products match these filters'), findsOneWidget);

        // Switching a chip off brings the products back.
        await tester.tap(
          find.descendant(of: controls, matching: find.text('Top rated')),
        );
        await tester.pumpAndSettle();
        expect(gridOrder(tester), ['p1']);
      },
    );

    testWidgets('products: the sort button reorders the grid', (tester) async {
      await pumpHome(tester);
      await tester.tap(find.byKey(const ValueKey('home-sort-button')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Price: low to high'));
      await tester.pumpAndSettle();
      // 199,000 (offer), 385,000, then the one without a price.
      expect(gridOrder(tester), ['p1', 'p2', 'p3']);
      await tester.tap(find.byKey(const ValueKey('home-sort-button')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Price: high to low'));
      await tester.pumpAndSettle();
      expect(gridOrder(tester), ['p2', 'p1', 'p3']);
    });

    testWidgets(
      'products: choosing a category narrows the page to its products',
      (tester) async {
        await pumpHome(tester);
        await tester.tap(find.text('Laptops').first);
        await tester.pumpAndSettle();
        expect(gridOrder(tester), ['p2']);
        // The companies and "recently added" rows belong to the whole catalogue.
        expect(
          find.byKey(const ValueKey('home-verified-companies')),
          findsNothing,
        );
        expect(find.byKey(const ValueKey('home-recent')), findsNothing);
        // The way back is still there.
        expect(find.byKey(const ValueKey('browse-crumb-root')), findsOneWidget);
      },
    );

    testWidgets('products: "All companies" goes to the companies tab', (
      tester,
    ) async {
      await pumpHome(tester);
      await tester.tap(find.byKey(const ValueKey('home-all-companies')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('home-companies-tab')), findsOneWidget);
    });

    testWidgets(
      'services: banner, steps, categories and a card for each service',
      (tester) async {
        await pumpHome(tester);
        await tester.tap(find.text('Services'));
        await tester.pumpAndSettle();
        expect(find.text('Need a technician?'), findsOneWidget);
        expect(
          find.byKey(const ValueKey('home-service-steps')),
          findsOneWidget,
        );
        expect(find.text('Services by category'), findsOneWidget);
        expect(find.text('Most requested'), findsOneWidget);

        final card = find.byKey(const ValueKey('home-service-s1'));
        expect(card, findsOneWidget);
        expect(
          find.descendant(of: card, matching: find.text('Network Setup')),
          findsOneWidget,
        );
        // The cheapest company leads, with how many others perform it.
        expect(
          find.descendant(of: card, matching: find.text('Alpha Systems')),
          findsOneWidget,
        );
        expect(
          find.descendant(of: card, matching: find.text('+1')),
          findsOneWidget,
        );
        expect(
          find.descendant(of: card, matching: find.text('Starts from')),
          findsOneWidget,
        );
        expect(
          find.descendant(
            of: card,
            matching: find.textContaining('40,000', findRichText: true),
          ),
          findsOneWidget,
        );
        expect(
          find.descendant(of: card, matching: find.text('50,000')),
          findsOneWidget,
        );
        expect(
          find.descendant(of: card, matching: find.text('20% off')),
          findsOneWidget,
        );
        // A service nobody performs yet is still listed, without a price.
        final bare = find.byKey(const ValueKey('home-service-s2'));
        expect(bare, findsOneWidget);
        expect(
          find.descendant(of: bare, matching: find.text('Starts from')),
          findsNothing,
        );
      },
    );

    testWidgets(
      'services: "Request service" opens the service and its companies',
      (tester) async {
        await pumpHome(tester);
        await tester.tap(find.text('Services'));
        await tester.pumpAndSettle();
        await tester.tap(
          find.descendant(
            of: find.byKey(const ValueKey('home-service-s1')),
            matching: find.text('Request service'),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byType(ServiceDetailsScreen), findsOneWidget);
      },
    );

    testWidgets('services: the banner button scrolls down to the list', (
      tester,
    ) async {
      // A short screen, so the list starts below the fold.
      await pumpHome(tester, height: 700);
      await tester.tap(find.text('Services'));
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(const ValueKey('home-service-banner-action')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Most requested').hitTestable(), findsOneWidget);
    });

    testWidgets('companies: the best rated is featured, the others are rows', (
      tester,
    ) async {
      await pumpHome(tester);
      await tester.tap(find.text('Companies'));
      await tester.pumpAndSettle();
      expect(find.text('3 verified companies'), findsOneWidget);
      expect(
        within('home-featured-company', find.text('Beta Networks')),
        findsOneWidget,
      );
      expect(
        within('home-featured-company', find.text('Visit company')),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('home-company-c3')), findsOneWidget);
      expect(find.byKey(const ValueKey('home-company-c1')), findsOneWidget);
      // The tags are the categories a company works in.
      expect(
        within('home-featured-company', find.text('Networks')),
        findsOneWidget,
      );
      expect(within('home-company-c1', find.text('Laptops')), findsOneWidget);
    });

    testWidgets(
      'companies: a category chip filters, sorting by name drops the feature',
      (tester) async {
        await pumpHome(tester);
        await tester.tap(find.text('Companies'));
        await tester.pumpAndSettle();
        final chips = find.byKey(const ValueKey('home-company-chips'));
        await tester.tap(
          find.descendant(of: chips, matching: find.text('Security')),
        );
        await tester.pumpAndSettle();
        expect(find.text('1 verified company'), findsOneWidget);
        expect(find.text('Gamma Tech'), findsOneWidget);
        expect(find.text('Beta Networks'), findsNothing);

        await tester.tap(
          find.descendant(of: chips, matching: find.text('All')),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const ValueKey('home-company-sort')));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Name'));
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('home-featured-company')),
          findsNothing,
        );
        expect(find.byKey(const ValueKey('home-company-c1')), findsOneWidget);
      },
    );

    for (final locale in const [Locale('en'), Locale('ar')]) {
      for (final width in const [320.0, 390.0, 800.0]) {
        testWidgets(
          'lays out without overflow: ${locale.languageCode}, ${width.toInt()} wide, large text',
          (tester) async {
            // Any overflow or other error fails the test by itself, with the
            // widgets involved in the report.
            await pumpHome(
              tester,
              locale: locale,
              width: width,
              textScale: 1.4,
            );
            final tabs = locale.languageCode == 'ar'
                ? ['الخدمات', 'الشركات']
                : ['Services', 'Companies'];
            for (final tab in tabs) {
              await tester.tap(find.text(tab).first);
              await tester.pumpAndSettle();
            }
          },
        );
      }
    }
  });

  group('the product card', () {
    testWidgets(
      'shows what a customer needs, and opens nothing it should not',
      (tester) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              ratingsProvider.overrideWith(
                (ref) => Stream.value({
                  'product_p9': const RatingStats(sum: 9, count: 2),
                }),
              ),
            ],
            child: MaterialApp(
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              home: Scaffold(
                body: SizedBox(
                  width: 200,
                  child: ProductGridCard(
                    product: _product(
                      'p9',
                      'Test Product',
                      price: 1500,
                      installation: true,
                    ),
                    categoryName: 'Networks',
                    isNew: true,
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Test Product'), findsOneWidget);
        expect(find.text('Networks'), findsOneWidget);
        expect(
          find.textContaining('1,500', findRichText: true),
          findsOneWidget,
        );
        expect(find.text('New'), findsOneWidget);
        expect(find.text('Delivery'), findsOneWidget);
        expect(find.text('Installation'), findsOneWidget);
        expect(find.text('4.5'), findsOneWidget);
      },
    );
  });
}
