import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_services/data/models/company_service_model.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_cards.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_hero_offers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_home.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_look.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/review.dart';
import 'package:sudan_it_marketplace/features/reviews/presentation/reviews_providers.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

/// The app's home is sictm.net's home: the same sections in the same order,
/// with the site's rules for what each one shows.

Category _cat(String id, String en, String ar, String icon, {String color = ''}) =>
    Category(
      id: id,
      name: en,
      nameEn: en,
      nameAr: ar,
      description: '',
      iconName: icon,
      colorName: color,
      isActive: true,
      createdAt: DateTime(2026),
      sortOrder: null,
    );

final _categories = [
  _cat('net', 'Networks', 'الشبكات', 'network'),
  _cat('sec', 'Security', 'الأمن', ''),
];

Product _product(
  String id, {
  double? price = 1000,
  double? offerPrice,
  DateTime? offerEndsAt,
  String companyId = 'c1',
  DateTime? createdAt,
}) =>
    Product(
      id: id,
      name: 'Product $id',
      price: price,
      offerPrice: offerPrice,
      offerEndsAt: offerEndsAt,
      categoryId: 'net',
      companyId: companyId,
      companyName: 'Co',
      createdAt: createdAt,
    );

const _c1 = Company(id: 'c1', name: 'Alpha', rating: 4.0, reviewCount: 10, city: 'الخرطوم');
const _c2 = Company(id: 'c2', name: 'Beta', rating: 4.8, reviewCount: 31, city: 'كسلا');

final _now = DateTime.now();
final _products = [
  _product('old', createdAt: _now.subtract(const Duration(days: 30))),
  _product('fresh', createdAt: _now.subtract(const Duration(days: 1))),
  _product('deal', offerPrice: 600, offerEndsAt: _now.add(const Duration(hours: 3))),
];
final _services = [
  CatalogService(
    id: 's1',
    categoryId: 'net',
    name: 'Network Setup',
    description: '',
    isActive: true,
    createdAt: DateTime(2026),
  ),
];
final _links = [
  CompanyServiceModel(
    id: 'c1_s1',
    companyId: 'c1',
    serviceId: 's1',
    isActive: true,
    createdAt: DateTime(2026),
    price: 50000,
    offerPrice: 40000,
  ),
];

Future<List<String>> _pumpHome(
  WidgetTester tester, {
  Locale locale = const Locale('en'),
  double width = 390,
  double textScale = 1,
}) async {
  tester.view.physicalSize = Size(width, 9000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final opened = <String>[];
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        marketplaceProductsProvider.overrideWithValue(_products),
        firestoreProductsStreamProvider.overrideWith((ref) => Stream.value(_products)),
        marketplaceCompaniesProvider.overrideWithValue(const [_c1, _c2]),
        firestoreCompaniesStreamProvider.overrideWith(
          (ref) => Stream.value(const [_c1, _c2]),
        ),
        allCategoriesProvider.overrideWith((ref) => Stream.value(_categories)),
        activeServicesProvider(null).overrideWith((ref) => Stream.value(_services)),
        allActiveCompanyServicesProvider.overrideWith((ref) => Stream.value(_links)),
        ratingsProvider.overrideWith(
          (ref) => Stream.value({
            RatingStats.keyFor('company', 'c1'): const RatingStats(sum: 9, count: 2),
          }),
        ),
      ],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: Scaffold(
          body: SiteHomePage(
            links: SiteHomeLinks(
              products: () => opened.add('products'),
              services: () => opened.add('services'),
              companies: () => opened.add('companies'),
              orders: () => opened.add('orders'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 100));
  return opened;
}

double _top(WidgetTester tester, String key) =>
    tester.getTopLeft(find.byKey(ValueKey(key))).dy;

void main() {
  testWidgets('the sections come in the site order', (tester) async {
    await _pumpHome(tester);
    expect(find.text('All your tech\nin one place'), findsOneWidget);
    expect(find.byKey(const ValueKey('site-hero-offers')), findsOneWidget);
    expect(_top(tester, 'site-hero'), lessThan(_top(tester, 'site-hero-offers')));
    expect(_top(tester, 'site-hero-offers'), lessThan(_top(tester, 'site-stats')));
    expect(_top(tester, 'site-stats'), lessThan(_top(tester, 'site-category-net')));
    expect(_top(tester, 'site-category-net'), lessThan(_top(tester, 'site-promo')));
    expect(find.text('Featured offers'), findsOneWidget);
    expect(find.text('Newest products'), findsOneWidget);
    expect(find.text('Featured services'), findsOneWidget);
    expect(find.text('Top companies'), findsOneWidget);
    expect(_top(tester, 'site-promo'), lessThan(_top(tester, 'site-product-deal')));
    expect(_top(tester, 'site-service-s1'), lessThan(_top(tester, 'site-company-c1')));
    expect(_top(tester, 'site-company-c1'), lessThan(_top(tester, 'site-footer')));
    // Stop the offers' clocks before the test ends.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('the numbers, the offers and the newest products follow the site rules',
      (tester) async {
    await _pumpHome(tester);
    // 2 companies, 3 products + 1 service offered, 2 cities, 2 company reviews.
    final stats = find.byKey(const ValueKey('site-stats'));
    for (final n in ['2', '4']) {
      expect(find.descendant(of: stats, matching: find.text(n)), findsWidgets);
    }
    expect(find.descendant(of: stats, matching: find.text('Customer reviews')), findsOneWidget);
    // The offer is in «عروض مميزة» only; the newest list starts with the
    // freshest of the others.
    expect(find.byKey(const ValueKey('site-product-deal')), findsOneWidget);
    expect(_top(tester, 'site-product-fresh'), lessThan(_top(tester, 'site-product-old')));
    // The countdown runs under a day.
    expect(find.byKey(const ValueKey('site-offer-clock')), findsWidgets);
    // Top companies: the best average first (live ratings over the document).
    expect(_top(tester, 'site-company-c2'), lessThan(_top(tester, 'site-company-c1')));
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('"View all" and the promo open the pages of the top strip', (tester) async {
    final opened = await _pumpHome(tester);
    await tester.tap(find.byKey(const ValueKey('site-promo')));
    await tester.tap(find.text('View all →').first);
    expect(opened, ['services', 'products']);
    await tester.pumpWidget(const SizedBox());
  });

  for (final (locale, width, scale) in [
    (const Locale('ar'), 320.0, 1.3),
    (const Locale('ar'), 390.0, 1.0),
    (const Locale('en'), 320.0, 1.3),
  ]) {
    testWidgets('lays out without overflow: ${locale.languageCode}, $width wide, text x$scale',
        (tester) async {
      await _pumpHome(tester, locale: locale, width: width, textScale: scale);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  }

  group('the site look', () {
    test('a category shows the picked shape, else one its name hints at, else a box', () {
      expect(siteCategoryEmoji(_categories[0]), '🌐');
      expect(siteCategoryEmoji(_cat('x', 'Misc', 'كاميرات المراقبة', '')), '🎥');
      expect(siteCategoryEmoji(_cat('y', 'Misc', 'متفرقات', '')), '📦');
    });

    test('colours: the one Platform Admin picked, else the same one as the site', () {
      expect(siteCategoryColor(_cat('a', 'A', 'A', '', color: 'green')), const Color(0xFF16A34A));
      // Values computed by customer_web/src/data/format.ts categoryColor().
      expect(siteCategoryColor(_categories[0]), const Color(0xFF0284C7));
      expect(siteCategoryColor(null, 'c1'), const Color(0xFFF97316));
      expect(siteCategoryColor(null, 'LongCompanyIdentifier123'), const Color(0xFF9333EA));
    });

    test('an offer counts days from a day on, then hours, minutes and seconds', () {
      final now = DateTime(2026, 11, 14, 12);
      expect(siteOfferTimeLeft(now.add(const Duration(days: 3, hours: 2)), now)?.days, 3);
      expect(
        siteOfferTimeLeft(now.add(const Duration(hours: 5, minutes: 7, seconds: 9)), now)?.parts,
        ['05', '07', '09'],
      );
      expect(siteOfferTimeLeft(now, now), isNull);
    });

    test('a product is new for 14 days', () {
      expect(siteIsNewProduct(_product('a', createdAt: _now.subtract(const Duration(days: 13)))), isTrue);
      expect(siteIsNewProduct(_product('b', createdAt: _now.subtract(const Duration(days: 15)))), isFalse);
    });
  });
}
