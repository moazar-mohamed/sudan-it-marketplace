import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sudan_it_marketplace/core/localization/locale_controller.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/dashboard_home_tab.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/product_details_screen.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/search/presentation/customer_search_screen.dart';
import 'package:sudan_it_marketplace/features/search/presentation/recent_searches.dart';
import 'package:sudan_it_marketplace/features/services/domain/entities/catalog_service.dart';
import 'package:sudan_it_marketplace/features/services/presentation/service_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

final _created = DateTime(2026, 9, 1);

Category _category(String id, String name, {String? parentId, String nameAr = ''}) =>
    Category(
      id: id,
      name: name,
      nameAr: nameAr,
      description: '',
      iconName: '',
      isActive: true,
      createdAt: _created,
      parentId: parentId,
      ancestorIds: [?parentId],
    );

final _categories = [
  _category('computers', 'Computers', nameAr: 'كمبيوترات'),
  _category('laptops', 'Laptops', parentId: 'computers'),
  _category('networks', 'Networks'),
];

const _products = [
  Product(id: 'p1', name: 'Dell Laptop X9', price: 900, categoryId: 'laptops'),
  Product(id: 'p2', name: 'HP Laptop Pro', price: 800, categoryId: 'laptops'),
  Product(id: 'p3', name: 'Lenovo Laptop Air', price: 700, categoryId: 'laptops'),
  Product(id: 'p4', name: 'Acer Laptop One', price: 600, categoryId: 'laptops'),
  Product(id: 'p5', name: 'TP-Link Router', price: 100, categoryId: 'networks'),
];

final _services = [
  CatalogService(
    id: 's1',
    categoryId: 'computers',
    name: 'Laptop Repair',
    description: 'Screens and keyboards',
    isActive: true,
    createdAt: _created,
  ),
];

const _companies = [
  Company(id: 'c1', name: 'Laptop House', rating: 4, reviewCount: 2),
  Company(id: 'c2', name: 'Nile Networks', rating: 4, reviewCount: 2),
];

Future<SharedPreferences> _prefs([Map<String, Object> values = const {}]) {
  SharedPreferences.setMockInitialValues(values);
  return SharedPreferences.getInstance();
}

Widget _app(
  SharedPreferences prefs, {
  Widget home = const CustomerSearchScreen(),
  Locale locale = const Locale('en'),
}) {
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      marketplaceProductsProvider.overrideWithValue(_products),
      marketplaceCompaniesProvider.overrideWithValue(_companies),
      marketplaceServicesProvider.overrideWithValue(AsyncValue.data(_services)),
      allCategoriesProvider.overrideWith((_) => Stream.value(_categories)),
      firestoreProductsStreamProvider.overrideWith((_) => Stream.value(const [])),
      firestoreCompaniesStreamProvider.overrideWith((_) => Stream.value(const [])),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: home,
    ),
  );
}

Future<void> _type(WidgetTester tester, String text) async {
  await tester.enterText(find.byKey(const ValueKey('customer-search-field')), text);
  await tester.pumpAndSettle();
}

Future<void> _submit(WidgetTester tester, String text) async {
  await _type(tester, text);
  await tester.testTextInput.receiveAction(TextInputAction.search);
  await tester.pumpAndSettle();
}

void main() {
  group('recent searches on the device', () {
    test('newest first, kept once, at most eight, and remembered', () async {
      final prefs = await _prefs();
      final container = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);
      final history = container.read(recentSearchesProvider.notifier);

      for (var i = 1; i <= 9; i++) {
        await history.add('query $i');
      }
      await history.add('  QUERY 5 ');
      final saved = container.read(recentSearchesProvider);
      expect(saved.first, 'QUERY 5');
      expect(saved.where((q) => q.toLowerCase() == 'query 5'), hasLength(1));
      expect(saved, hasLength(maxRecentSearches));
      expect(prefs.getStringList(recentSearchesKey), saved);

      await history.add('   ');
      expect(container.read(recentSearchesProvider), saved);
    });
  });

  testWidgets('the home search bar opens the search screen', (tester) async {
    await tester.pumpWidget(
      _app(await _prefs(), home: const Scaffold(body: DashboardHomeTab())),
    );
    await tester.pumpAndSettle();

    expect(find.text('Search products, services and companies'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('home-search-launcher')));
    await tester.pumpAndSettle();
    expect(find.byType(CustomerSearchScreen), findsOneWidget);
  });

  testWidgets('before typing: recent searches and categories', (tester) async {
    final prefs = await _prefs({
      recentSearchesKey: ['router', 'dell'],
    });
    await tester.pumpWidget(_app(prefs));
    await tester.pumpAndSettle();

    expect(find.text('Recent searches'), findsOneWidget);
    expect(find.text('router'), findsOneWidget);
    expect(find.text('Browse categories'), findsOneWidget);
    expect(find.text('Computers'), findsOneWidget);
    expect(find.text('Networks'), findsOneWidget);
    expect(find.text('Laptops'), findsNothing, reason: 'top level only');

    await tester.tap(find.byTooltip('Remove from history').first);
    await tester.pumpAndSettle();
    expect(find.text('router'), findsNothing);
    expect(prefs.getStringList(recentSearchesKey), ['dell']);

    // A recent search runs again.
    await tester.tap(find.text('dell'));
    await tester.pumpAndSettle();
    expect(find.text('Dell Laptop X9'), findsOneWidget);

    await tester.tap(find.byTooltip('Clear'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Clear'));
    await tester.pumpAndSettle();
    expect(find.text('Recent searches'), findsNothing);
  });

  testWidgets('while typing: suggestions that open what they name',
      (tester) async {
    final prefs = await _prefs();
    await tester.pumpWidget(_app(prefs));
    await tester.pumpAndSettle();

    await _type(tester, 'lapt');
    expect(find.text('Search for “lapt”'), findsOneWidget);
    // Three products at most, then services and companies, each labelled.
    expect(find.byKey(const ValueKey('suggestion-product-p1')), findsOneWidget);
    expect(find.byKey(const ValueKey('suggestion-product-p4')), findsNothing);
    expect(find.byKey(const ValueKey('suggestion-service-s1')), findsOneWidget);
    expect(find.byKey(const ValueKey('suggestion-company-c1')), findsOneWidget);
    expect(find.text('Service'), findsOneWidget);
    expect(find.text('Company'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('suggestion-product-p1')));
    await tester.pumpAndSettle();
    expect(find.byType(ProductDetailsScreen), findsOneWidget);
    expect(prefs.getStringList(recentSearchesKey), ['lapt']);
  });

  testWidgets('results: products, services and companies together, grouped',
      (tester) async {
    tester.view.physicalSize = const Size(400, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app(await _prefs()));
    await tester.pumpAndSettle();

    await _submit(tester, 'laptop');
    expect(find.text('All (6)'), findsOneWidget);
    expect(find.text('Products (4)'), findsOneWidget);
    expect(find.text('Services (1)'), findsOneWidget);
    expect(find.text('Companies (1)'), findsOneWidget);
    // "All" previews three products and offers the rest.
    expect(find.text('See all (4)'), findsOneWidget);
    expect(find.text('Acer Laptop One'), findsNothing);
    expect(find.text('Laptop Repair'), findsOneWidget);
    expect(find.text('Laptop House'), findsOneWidget);

    await tester.tap(find.text('See all (4)'));
    await tester.pumpAndSettle();
    expect(find.text('Acer Laptop One'), findsOneWidget);
    expect(find.text('Laptop Repair'), findsNothing);
  });

  testWidgets('the matched words are marked in the results', (tester) async {
    await tester.pumpWidget(_app(await _prefs()));
    await tester.pumpAndSettle();

    await _submit(tester, 'router');
    final rich = tester.widget<RichText>(find.byWidgetPredicate(
      (w) => w is RichText && w.text.toPlainText() == 'TP-Link Router',
    ));
    final marked = <String>[];
    rich.text.visitChildren((span) {
      if (span is TextSpan && span.style?.backgroundColor != null) {
        marked.add(span.text ?? '');
      }
      return true;
    });
    expect(marked, ['Router']);
  });

  testWidgets('Arabic words find English names, and the page is RTL',
      (tester) async {
    await tester.pumpWidget(_app(await _prefs(), locale: const Locale('ar')));
    await tester.pumpAndSettle();

    await _submit(tester, 'لابتوب');
    expect(find.text('منتجات (4)'), findsOneWidget);
    expect(find.text('Dell Laptop X9'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('Dell Laptop X9'))),
      TextDirection.rtl,
    );
  });

  testWidgets('a category searches everything under it', (tester) async {
    await tester.pumpWidget(_app(await _prefs()));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('search-category-computers')));
    await tester.pumpAndSettle();
    // Products of the "Laptops" sub-category and the service in "Computers".
    expect(find.text('Products (4)'), findsOneWidget);
    expect(find.text('Services (1)'), findsOneWidget);
    expect(find.text('TP-Link Router'), findsNothing);
  });

  testWidgets('nothing found: says so and offers the categories',
      (tester) async {
    await tester.pumpWidget(_app(await _prefs()));
    await tester.pumpAndSettle();

    await _submit(tester, 'qwertyzz');
    expect(find.text('No results for “qwertyzz”'), findsOneWidget);
    expect(
      find.text('Check the spelling, try a shorter word, or browse a category.'),
      findsOneWidget,
    );
    expect(find.text('Browse categories'), findsOneWidget);
  });
}
