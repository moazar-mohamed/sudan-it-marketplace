import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/category_grid.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/dashboard_home_tab.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

final _created = DateTime(2026);

Category _c(
  String id,
  String? parentId,
  String en, {
  String ar = '',
  bool isActive = true,
  int? sortOrder,
}) => Category(
  id: id,
  name: en,
  nameAr: ar,
  nameEn: en,
  description: '',
  iconName: '',
  isActive: isActive,
  createdAt: _created,
  parentId: parentId,
  sortOrder: sortOrder,
);

Product _p(String name, String? categoryId) => Product(
  id: 'p-$name',
  name: name,
  price: 100,
  companyId: 'c1',
  companyName: 'Nile Tech',
  categoryId: categoryId,
);

CatalogService _s(String name, String categoryId) => CatalogService(
  id: 's-$name',
  categoryId: categoryId,
  name: name,
  description: 'About $name',
  isActive: true,
  createdAt: _created,
);

const _company = Company(
  id: 'c1',
  name: 'Nile Tech',
  rating: 4,
  reviewCount: 1,
  status: 'active',
);

/// One tree for products and services: Networking > Routers > Wi-Fi 6 ;
/// Networking > Switches (no products) ; Laptops ; Empty (nothing in it) ;
/// Installation > Cabling ; Support.
List<Category> _categories() => [
  _c('net', null, 'Networking', ar: 'شبكات', sortOrder: 0),
  _c('rou', 'net', 'Routers', ar: 'راوترات', sortOrder: 0),
  _c('wifi', 'rou', 'Wi-Fi 6', ar: 'واي فاي'),
  _c('swi', 'net', 'Switches', ar: 'سويتشات', sortOrder: 1),
  _c('lap', null, 'Laptops', ar: 'لابتوبات', sortOrder: 1),
  _c('emp', null, 'Empty', sortOrder: 2),
  _c('ins', null, 'Installation'),
  _c('cab', 'ins', 'Cabling'),
  _c('sup', null, 'Support'),
];

final _products = [
  _p('TP-Link AX', 'wifi'),
  _p('Cisco Router', 'rou'),
  _p('Dell Latitude', 'lap'),
];

final _services = [
  _s('Wall cabling', 'cab'),
  _s('Rack install', 'ins'),
  _s('Help desk', 'sup'),
];

/// A category tile of the browser (its name also appears on product cards).
Finder tile(String name) =>
    find.descendant(of: find.byType(CategoryGrid), matching: find.text(name));

void main() {
  Future<void> pumpHome(
    WidgetTester tester, {
    Stream<List<Category>>? categories,
    Stream<List<Product>>? products,
    Locale locale = const Locale('en'),
  }) async {
    tester.view.physicalSize = const Size(800, 3600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          firestoreProductsStreamProvider.overrideWith(
            (ref) => products ?? Stream.value(_products),
          ),
          firestoreCompaniesStreamProvider.overrideWith(
            (ref) => Stream.value(const [_company]),
          ),
          activeServicesProvider(null)
              .overrideWith((ref) => Stream.value(_services)),
          allCategoriesProvider.overrideWith(
            (ref) => categories ?? Stream.value(_categories()),
          ),
        ],
        child: MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: const [Locale('en'), Locale('ar')],
          home: const Scaffold(body: DashboardHomeTab()),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> tapTile(WidgetTester tester, String name) async {
    await tester.tap(find.text(name).first);
    await tester.pumpAndSettle();
  }

  final tileNet = tile('Networking');

  group('browsing the categories on the products tab', () {
    testWidgets(
      'shows every top-level category, including one with nothing in it yet',
      (tester) async {
        await pumpHome(tester);
        expect(tileNet, findsOneWidget);
        expect(tile('Laptops'), findsOneWidget);
        expect(tile('Empty'), findsOneWidget);
        expect(tile('Installation'), findsOneWidget);
        expect(tile('Support'), findsOneWidget);
        // deeper levels are not shown at the top
        expect(tile('Routers'), findsNothing);
        // every product is listed until a category is chosen
        expect(find.text('TP-Link AX'), findsOneWidget);
        expect(find.text('Dell Latitude'), findsOneWidget);
      },
    );

    testWidgets(
      'choosing a category filters by its whole subtree and shows its sub-categories',
      (tester) async {
        await pumpHome(tester);
        await tapTile(tester, 'Networking');

        // products of Networking, Routers and Wi-Fi 6 (three levels), not Laptops
        expect(find.text('TP-Link AX'), findsOneWidget);
        expect(find.text('Cisco Router'), findsOneWidget);
        expect(find.text('Dell Latitude'), findsNothing);
        // the way back, and the next level (empty sub-categories included)
        expect(find.byKey(const ValueKey('browse-crumb-root')), findsOneWidget);
        expect(tile('Routers'), findsOneWidget);
        expect(tile('Switches'), findsOneWidget);
        expect(tile('Laptops'), findsNothing);
      },
    );

    testWidgets(
      'goes deeper and narrows the list, then back up with the breadcrumb',
      (tester) async {
        await pumpHome(tester);
        await tapTile(tester, 'Networking');
        await tapTile(tester, 'Routers');
        expect(find.text('TP-Link AX'), findsOneWidget);
        expect(
          find.text('Cisco Router'),
          findsOneWidget,
        ); // filed directly in Routers
        await tapTile(tester, 'Wi-Fi 6');
        expect(find.text('TP-Link AX'), findsOneWidget);
        expect(find.text('Cisco Router'), findsNothing);

        // up one level, then all
        await tester.tap(find.byKey(const ValueKey('browse-crumb-rou')));
        await tester.pumpAndSettle();
        expect(find.text('Cisco Router'), findsOneWidget);
        await tester.tap(find.byKey(const ValueKey('browse-crumb-root')));
        await tester.pumpAndSettle();
        expect(find.text('Dell Latitude'), findsOneWidget);
        expect(find.byKey(const ValueKey('browse-crumb-root')), findsNothing);
      },
    );

    testWidgets('a Back button goes up one level, and is absent at the top', (tester) async {
      await pumpHome(tester);
      final back = find.byKey(const ValueKey('browse-back'));
      expect(back, findsNothing);

      await tapTile(tester, 'Networking');
      await tapTile(tester, 'Routers');
      await tapTile(tester, 'Wi-Fi 6');
      expect(back, findsOneWidget);
      expect(find.text('Cisco Router'), findsNothing); // narrowed to Wi-Fi 6

      await tester.tap(back); // Wi-Fi 6 -> Routers
      await tester.pumpAndSettle();
      expect(find.text('Cisco Router'), findsOneWidget);
      expect(tile('Wi-Fi 6'), findsOneWidget);

      await tester.tap(back); // Routers -> Networking
      await tester.pumpAndSettle();
      expect(tile('Routers'), findsOneWidget);
      expect(tile('Switches'), findsOneWidget);

      await tester.tap(back); // Networking -> all categories
      await tester.pumpAndSettle();
      expect(tile('Laptops'), findsOneWidget);
      expect(find.text('Dell Latitude'), findsOneWidget);
      expect(back, findsNothing);
    });

    testWidgets('the Back button works on the services tab too', (tester) async {
      await pumpHome(tester);
      await tester.tap(find.text('Services'));
      await tester.pumpAndSettle();
      await tapTile(tester, 'Installation');
      expect(find.text('Help desk'), findsNothing);
      await tester.tap(find.byKey(const ValueKey('browse-back')));
      await tester.pumpAndSettle();
      expect(find.text('Help desk'), findsOneWidget);
      expect(find.byKey(const ValueKey('browse-back')), findsNothing);
    });

    testWidgets(
      'a category deactivated by Platform Admin disappears with everything under it',
      (tester) async {
        final feed = StreamController<List<Category>>();
        addTearDown(feed.close);
        feed.add(_categories());
        await pumpHome(tester, categories: feed.stream);
        expect(tileNet, findsOneWidget);
        feed.add(
          _categories()
              .map(
                (c) => c.id == 'net'
                    ? _c('net', null, 'Networking', isActive: false)
                    : c,
              )
              .toList(),
        );
        await tester.pumpAndSettle();
        expect(tileNet, findsNothing);
        expect(tile('Laptops'), findsOneWidget);
      },
    );

    testWidgets(
      'a category browsed when it disappears falls back to all products',
      (tester) async {
        final feed = StreamController<List<Category>>();
        addTearDown(feed.close);
        feed.add(_categories());
        await pumpHome(tester, categories: feed.stream);
        await tapTile(tester, 'Networking');
        expect(find.text('Dell Latitude'), findsNothing);
        feed.add(_categories().where((c) => c.id != 'net').toList());
        await tester.pumpAndSettle();
        expect(find.text('Dell Latitude'), findsOneWidget);
      },
    );

    testWidgets('a new category appears at once, before any product is in it', (
      tester,
    ) async {
      final categories = StreamController<List<Category>>();
      final products = StreamController<List<Product>>();
      addTearDown(categories.close);
      addTearDown(products.close);
      categories.add(_categories());
      products.add(_products);
      await pumpHome(
        tester,
        categories: categories.stream,
        products: products.stream,
      );
      expect(tile('Printers'), findsNothing);

      categories.add([
        ..._categories(),
        _c('prn', null, 'Printers', sortOrder: 3),
        _c('las', 'prn', 'Laser'),
      ]);
      await tester.pumpAndSettle();
      expect(tile('Printers'), findsOneWidget);
      await tapTile(tester, 'Printers');
      expect(find.text('No products found'), findsOneWidget);
      expect(tile('Laser'), findsOneWidget);

      // then a company files a product in it
      products.add([..._products, _p('HP LaserJet', 'las')]);
      await tester.pumpAndSettle();
      expect(find.text('HP LaserJet'), findsOneWidget);
    });

    testWidgets('older categories (no parent) are top-level ones', (
      tester,
    ) async {
      await pumpHome(
        tester,
        categories: Stream.value([_c('old', null, 'Legacy')]),
        products: Stream.value([_p('Old thing', 'old')]),
      );
      expect(tile('Legacy'), findsOneWidget);
      await tapTile(tester, 'Legacy');
      expect(find.text('Old thing'), findsOneWidget);
    });
  });

  group('browsing the categories on the services tab', () {
    Future<void> openServices(WidgetTester tester) async {
      await tester.tap(find.text('Services'));
      await tester.pumpAndSettle();
    }

    testWidgets('shows the same categories as the products tab', (
      tester,
    ) async {
      await pumpHome(tester);
      final topLevel = [
        'Networking',
        'Laptops',
        'Empty',
        'Installation',
        'Support',
      ];
      for (final name in topLevel) {
        expect(tile(name), findsOneWidget);
      }
      await openServices(tester);
      for (final name in topLevel) {
        expect(tile(name), findsOneWidget);
      }
      // ... and the companies tab has none
      await tester.tap(find.text('Companies'));
      await tester.pumpAndSettle();
      expect(find.byType(CategoryGrid), findsNothing);
      await tester.tap(find.text('Services'));
      await tester.pumpAndSettle();
      expect(find.text('Wall cabling'), findsOneWidget);
      expect(find.text('Help desk'), findsOneWidget);
    });

    testWidgets('choosing a service category filters services by its subtree', (
      tester,
    ) async {
      await pumpHome(tester);
      await openServices(tester);
      await tapTile(tester, 'Installation');
      expect(
        find.text('Wall cabling'),
        findsOneWidget,
      ); // in Cabling, below Installation
      expect(find.text('Rack install'), findsOneWidget);
      expect(find.text('Help desk'), findsNothing);
      expect(tile('Cabling'), findsOneWidget); // the next level
    });

    testWidgets('each tab remembers its own category', (tester) async {
      await pumpHome(tester);
      await tapTile(tester, 'Laptops');
      await openServices(tester);
      await tapTile(tester, 'Support');
      expect(find.text('Help desk'), findsOneWidget);
      expect(find.text('Wall cabling'), findsNothing);
      await tester.tap(find.text('Products'));
      await tester.pumpAndSettle();
      expect(find.text('Dell Latitude'), findsOneWidget); // still on Laptops
      expect(find.text('TP-Link AX'), findsNothing);
    });

    testWidgets('a service under a deactivated category is hidden', (
      tester,
    ) async {
      await pumpHome(
        tester,
        categories: Stream.value(
          _categories()
              .map(
                (c) => c.id == 'ins'
                    ? _c('ins', null, 'Installation', isActive: false)
                    : c,
              )
              .toList(),
        ),
      );
      await openServices(tester);
      expect(
        find.text('Wall cabling'),
        findsNothing,
      ); // its parent is deactivated
      expect(find.text('Rack install'), findsNothing);
      expect(find.text('Help desk'), findsOneWidget);
    });
  });

  testWidgets('categories are named and ordered in Arabic', (tester) async {
    await pumpHome(tester, locale: const Locale('ar'));
    expect(tile('شبكات'), findsOneWidget);
    await tapTile(tester, 'شبكات');
    expect(tile('راوترات'), findsOneWidget);
  });
}
