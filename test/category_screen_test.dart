import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_services/data/models/company_service_model.dart';
import 'package:sudan_it_marketplace/features/company_services/presentation/company_service_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/category_screen.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/dashboard_home_tab.dart';
import 'package:sudan_it_marketplace/features/offers/domain/offer_pricing.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/widgets/product_grid_card.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/review.dart';
import 'package:sudan_it_marketplace/features/reviews/presentation/reviews_providers.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

Category _cat(
  String id,
  String en,
  String ar,
  String icon, {
  String? parent,
  bool isActive = true,
  String color = '',
}) => Category(
  id: id,
  name: en,
  nameEn: en,
  nameAr: ar,
  description: '',
  iconName: icon,
  colorName: color,
  isActive: isActive,
  createdAt: DateTime(2026),
  parentId: parent,
);

/// Networks > Routers > Wi-Fi ; Networks > Switches (nothing in it) ;
/// Laptops ; Empty (nothing in it).
List<Category> _categories({bool networksActive = true}) => [
  _cat('net', 'Networks', 'الشبكات', 'network', isActive: networksActive),
  _cat('rou', 'Routers', 'راوترات', 'router', parent: 'net'),
  _cat('wifi', 'Wi-Fi', 'واي فاي', 'wifi', parent: 'rou'),
  _cat('swi', 'Switches', 'سويتشات', 'network', parent: 'net'),
  _cat('lap', 'Laptops', 'اللابتوبات', 'laptop'),
  _cat('emp', 'Empty', 'فارغ', 'tools'),
];

Product _product(
  String id,
  String name, {
  required String categoryId,
  required String companyId,
  required String companyName,
  String brand = '',
  double? price = 1000,
  double? offerPrice,
  bool inStock = true,
}) => Product(
  id: id,
  name: name,
  brand: brand,
  price: price,
  offerPrice: offerPrice,
  offerEndsAt: offerPrice == null
      ? null
      : DateTime.now().add(const Duration(days: 3)),
  offerBadge: offerPrice == null ? null : OfferBadge.discount,
  categoryId: categoryId,
  companyId: companyId,
  companyName: companyName,
  inStock: inStock,
  stockCount: 5,
);

final _products = [
  _product(
    'p1',
    'Alpha Router',
    categoryId: 'rou',
    companyId: 'c2',
    companyName: 'Beta Networks',
    brand: 'Cisco',
    price: 250000,
    offerPrice: 199000,
  ),
  _product(
    'p2',
    'Beta Access Point',
    categoryId: 'wifi',
    companyId: 'c1',
    companyName: 'Alpha Systems',
    brand: 'Ubiquiti',
    price: 80000,
  ),
  _product(
    'p3',
    'Gamma Hub',
    categoryId: 'net',
    companyId: 'c1',
    companyName: 'Alpha Systems',
    brand: 'cisco',
    price: 120000,
    inStock: false,
  ),
  _product(
    'p4',
    'Dell Laptop',
    categoryId: 'lap',
    companyId: 'c1',
    companyName: 'Alpha Systems',
    brand: 'Dell',
    price: 500000,
  ),
];

CatalogService _service(String id, String name, String categoryId) =>
    CatalogService(
      id: id,
      categoryId: categoryId,
      name: name,
      description: 'About $name',
      isActive: true,
      createdAt: DateTime(2026),
    );

final _services = [
  _service('s1', 'Network Setup', 'rou'),
  _service('s2', 'Laptop Repair', 'lap'),
];

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
  offerEndsAt: offerPrice == null
      ? null
      : DateTime.now().add(const Duration(days: 3)),
  offerBadge: offerPrice == null ? null : OfferBadge.discount,
);

final _links = [
  _link('c1', 's1', price: 50000, offerPrice: 40000),
  _link('c2', 's2', price: 20000),
];

const _companies = [
  Company(id: 'c1', name: 'Alpha Systems', rating: 4, reviewCount: 1),
  Company(id: 'c2', name: 'Beta Networks', rating: 4, reviewCount: 1),
];

List<Object> _overrides({
  List<Category>? categories,
  List<Product>? products,
}) => [
  marketplaceProductsProvider.overrideWithValue(products ?? _products),
  firestoreProductsStreamProvider.overrideWith(
    (ref) => Stream.value(products ?? _products),
  ),
  marketplaceCompaniesProvider.overrideWithValue(_companies),
  firestoreCompaniesStreamProvider.overrideWith(
    (ref) => Stream.value(_companies),
  ),
  allCategoriesProvider.overrideWith(
    (ref) => Stream.value(categories ?? _categories()),
  ),
  activeServicesProvider(null).overrideWith((ref) => Stream.value(_services)),
  allActiveCompanyServicesProvider.overrideWith((ref) => Stream.value(_links)),
  ratingsProvider.overrideWith(
    (ref) => Stream.value(const <String, RatingStats>{}),
  ),
];

void main() {
  Future<void> pumpScreen(
    WidgetTester tester,
    String categoryId, {
    List<Category>? categories,
    Locale locale = const Locale('en'),
  }) async {
    tester.view.physicalSize = const Size(800, 4000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides(categories: categories).cast(),
        child: MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: const [Locale('en'), Locale('ar')],
          // A page below, so the root crumb has somewhere to go back to.
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CategoryScreen(categoryId: categoryId),
                  ),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  List<String> productIds(WidgetTester tester) => [
    for (final card in tester.widgetList<ProductGridCard>(
      find.byType(ProductGridCard),
    ))
      card.product.id,
  ];

  Finder priceField(String key) => find.descendant(
    of: find.byKey(ValueKey(key)),
    matching: find.byType(TextFormField),
  );

  Finder crumb(String id) => find.byKey(ValueKey('crumb-$id'));

  Future<void> tapText(WidgetTester tester, String text) async {
    await tester.tap(find.text(text).first);
    await tester.pumpAndSettle();
  }

  group('the home categories', () {
    Future<void> pumpHome(WidgetTester tester) async {
      tester.view.physicalSize = const Size(800, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: _overrides().cast(),
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: const [Locale('en'), Locale('ar')],
            home: const Scaffold(body: DashboardHomeTab()),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('show how much each one holds', (tester) async {
      await pumpHome(tester);
      // Networks: three products and the service, all below it.
      expect(find.text('4 items'), findsOneWidget);
      // Laptops: a product and a service.
      expect(find.text('2 items'), findsOneWidget);
    });

    testWidgets('leave out a category with nothing in it', (tester) async {
      await pumpHome(tester);
      expect(find.text('Laptops'), findsWidgets);
      expect(find.text('Networks'), findsWidgets);
      expect(find.text('Empty'), findsNothing);
    });

    testWidgets('open a screen of their own', (tester) async {
      await pumpHome(tester);
      await tester.tap(find.text('Laptops').first);
      await tester.pumpAndSettle();
      expect(find.byType(CategoryScreen), findsOneWidget);
      expect(productIds(tester), ['p4']);
    });
  });

  group('a category screen', () {
    testWidgets('shows the path and the sub-categories with their counts', (
      tester,
    ) async {
      await pumpScreen(tester, 'net');
      expect(find.byKey(const ValueKey('category-breadcrumb')), findsOneWidget);
      expect(crumb('net'), findsOneWidget);
      // Everything below Networks, and each sub-category that holds something.
      expect(find.text('All (4)'), findsOneWidget);
      expect(find.text('Routers (3)'), findsOneWidget);
      // Switches has nothing in it, so it is not offered.
      expect(find.textContaining('Switches'), findsNothing);
      expect(productIds(tester).toSet(), {'p1', 'p2', 'p3'});
      expect(find.text('Network Setup'), findsOneWidget);
      expect(find.text('Laptop Repair'), findsNothing);
    });

    testWidgets('a sub-category narrows the list in place', (tester) async {
      await pumpScreen(tester, 'net');
      await tapText(tester, 'Routers (3)');
      expect(productIds(tester).toSet(), {'p1', 'p2'});
      // The next level now, and the way up in the path.
      expect(find.text('All (3)'), findsOneWidget);
      expect(find.text('Wi-Fi (1)'), findsOneWidget);
      expect(crumb('net'), findsOneWidget);
      expect(crumb('rou'), findsOneWidget);

      await tapText(tester, 'Wi-Fi (1)');
      expect(productIds(tester), ['p2']);
      expect(find.text('Network Setup'), findsNothing);
    });

    testWidgets('a part of the path goes back up to it', (tester) async {
      await pumpScreen(tester, 'wifi');
      expect(productIds(tester), ['p2']);
      await tester.tap(crumb('net'));
      await tester.pumpAndSettle();
      expect(productIds(tester).toSet(), {'p1', 'p2', 'p3'});
    });

    testWidgets('a last-level category offers its siblings', (tester) async {
      await pumpScreen(tester, 'wifi');
      expect(find.text('All (3)'), findsOneWidget);
      expect(find.text('Wi-Fi (1)'), findsOneWidget);
    });

    testWidgets('"All categories" in the path returns to the home', (
      tester,
    ) async {
      await pumpScreen(tester, 'lap');
      await tester.tap(find.byKey(const ValueKey('crumb-root')));
      await tester.pumpAndSettle();
      expect(find.byType(CategoryScreen), findsNothing);
      expect(find.text('open'), findsOneWidget);
    });

    testWidgets('says so when nothing is listed in it', (tester) async {
      await pumpScreen(tester, 'emp');
      expect(find.text('Nothing is listed here yet.'), findsOneWidget);
    });

    testWidgets('says so when the category is gone or switched off', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        'rou',
        categories: _categories(networksActive: false),
      );
      expect(find.byType(ProductGridCard), findsNothing);
      expect(find.text('Routers (3)'), findsNothing);
    });

    testWidgets('reads right to left in Arabic', (tester) async {
      await pumpScreen(tester, 'net', locale: const Locale('ar'));
      expect(find.text('الشبكات'), findsWidgets);
      expect(find.text('راوترات (3)'), findsOneWidget);
    });
  });

  group('filtering a category screen', () {
    testWidgets('"Offers" keeps what is on offer, products and services', (
      tester,
    ) async {
      await pumpScreen(tester, 'net');
      await tapText(tester, 'Offers');
      expect(productIds(tester), ['p1']);
      expect(find.text('Network Setup'), findsOneWidget);
    });

    testWidgets('"In stock" keeps the products that can be bought', (
      tester,
    ) async {
      await pumpScreen(tester, 'net');
      await tapText(tester, 'In stock');
      expect(productIds(tester).toSet(), {'p1', 'p2'});
      // Services have no stock, so they are left out.
      expect(find.text('Network Setup'), findsNothing);
    });

    testWidgets('a brand keeps its products, however it is spelled', (
      tester,
    ) async {
      await pumpScreen(tester, 'net');
      await tapText(tester, 'Brand');
      // Each brand once: "Cisco" and "cisco" are the same one.
      expect(find.text('Cisco'), findsOneWidget);
      expect(find.text('Ubiquiti'), findsOneWidget);
      await tester.tap(find.text('Cisco'));
      await tester.pumpAndSettle();
      expect(productIds(tester).toSet(), {'p1', 'p3'});
      expect(find.text('Network Setup'), findsNothing);
      // The chip shows the brand, and "All brands" clears it.
      await tapText(tester, 'Cisco');
      await tester.tap(find.byKey(const ValueKey('filter-any')));
      await tester.pumpAndSettle();
      expect(productIds(tester).toSet(), {'p1', 'p2', 'p3'});
    });

    testWidgets('a price range keeps what is sold within it', (tester) async {
      await pumpScreen(tester, 'net');
      await tapText(tester, 'Price');
      await tester.enterText(priceField('price-min'), '100000');
      await tester.tap(find.byKey(const ValueKey('price-apply')));
      await tester.pumpAndSettle();
      // The offer price counts: 199,000 and 120,000, not 80,000.
      expect(productIds(tester).toSet(), {'p1', 'p3'});
      // The service starts from 40,000, below the range.
      expect(find.text('Network Setup'), findsNothing);
      expect(find.text('From 100000'), findsOneWidget);
    });

    testWidgets('a company keeps what it sells and does', (tester) async {
      await pumpScreen(tester, 'net');
      await tapText(tester, 'Company');
      await tester.tap(find.text('Alpha Systems').last);
      await tester.pumpAndSettle();
      expect(productIds(tester).toSet(), {'p2', 'p3'});
      // Alpha Systems performs the network setup.
      expect(find.text('Network Setup'), findsOneWidget);
    });

    testWidgets('products and services can be looked at on their own', (
      tester,
    ) async {
      await pumpScreen(tester, 'net');
      final kinds = find.byKey(const ValueKey('category-kind-chips'));
      await tester.tap(
        find.descendant(of: kinds, matching: find.text('Services')),
      );
      await tester.pumpAndSettle();
      expect(find.byType(ProductGridCard), findsNothing);
      expect(find.text('Network Setup'), findsOneWidget);
      await tester.tap(
        find.descendant(of: kinds, matching: find.text('Products')),
      );
      await tester.pumpAndSettle();
      expect(find.byType(ProductGridCard), findsNWidgets(3));
      expect(find.text('Network Setup'), findsNothing);
    });

    testWidgets('says nothing matches, and the filters can be cleared', (
      tester,
    ) async {
      await pumpScreen(tester, 'net');
      await tapText(tester, 'Price');
      await tester.enterText(priceField('price-min'), '9999999');
      await tester.tap(find.byKey(const ValueKey('price-apply')));
      await tester.pumpAndSettle();
      expect(find.text('Nothing matches these filters.'), findsOneWidget);
      await tester.tap(find.text('Clear filters'));
      await tester.pumpAndSettle();
      expect(productIds(tester).toSet(), {'p1', 'p2', 'p3'});
    });

    testWidgets('changing category starts with the filters cleared', (
      tester,
    ) async {
      await pumpScreen(tester, 'net');
      await tapText(tester, 'Offers');
      expect(productIds(tester), ['p1']);
      await tapText(tester, 'Routers (3)');
      expect(productIds(tester).toSet(), {'p1', 'p2'});
    });
  });
}
