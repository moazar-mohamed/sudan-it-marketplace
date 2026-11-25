import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/domain/category_tree.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/company_services/data/models/company_service_model.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/category_grid.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/category_grid_style.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_company_view.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_service_view.dart';
import 'package:sudan_it_marketplace/features/offers/domain/offer_pricing.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/review.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

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
      await tester.ensureVisible(find.text('Category 8').last);
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


}
