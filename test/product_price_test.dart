import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/services/image_upload_service.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/products/product_form_screen.dart';
import 'package:sudan_it_marketplace/features/products/data/models/product_model.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/repositories/products_repository.dart';
import 'package:sudan_it_marketplace/features/products/presentation/product_details_screen.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/widgets/product_card.dart';

const _en = Locale('en');
const _ar = Locale('ar');
const _onRequestEn = 'Price on request';
const _onRequestAr = 'السعر عند التواصل';

Product _product({double? price, int stock = 4}) => Product(
      id: 'real1',
      name: 'Dell Laptop',
      price: price,
      stockCount: stock,
    );

Widget _app(Widget home, {Locale locale = _en, List overrides = const []}) {
  return ProviderScope(
    // ignore: argument_type_not_assignable
    overrides: overrides.cast(),
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [_en, _ar],
      home: home,
    ),
  );
}

List _detailsOverrides(Product product) => [
      firestoreProductsStreamProvider
          .overrideWith((ref) => Stream.value([product])),
      resolvedCompanyProvider.overrideWith((ref, companyId) => null),
    ];

ElevatedButton _buyButton(WidgetTester tester) =>
    tester.widget<ElevatedButton>(find.byType(ElevatedButton));

// A minimal stand-in so ProductModel.fromFirestore can be tested without Firebase.
// ignore: subtype_of_sealed_class
class _FakeSnapshot extends Fake
    implements DocumentSnapshot<Map<String, dynamic>> {
  _FakeSnapshot(this._data);

  final Map<String, dynamic> _data;

  @override
  String get id => (_data['id'] as String?) ?? 'doc1';

  @override
  Map<String, dynamic>? data() => _data;
}

class _RecordingRepository extends Fake implements ProductsRepository {
  final created = <Product>[];

  @override
  String newProductId() => 'new1';

  @override
  Future<void> createProduct(Product product) async => created.add(product);
}

class _FakeStorage extends Fake implements FirebaseStorage {}

void main() {
  group('product model', () {
    test('a product without a price has no price (null, not 0)', () {
      final product = _product();
      expect(product.price, isNull);
      expect(product.hasPrice, isFalse);
    });

    test('0 is a real price, not a missing one', () {
      expect(_product(price: 0).hasPrice, isTrue);
    });

    test('a missing price is saved as null, never 0', () {
      final fields = ProductModel.toFirestoreFields(_product());
      expect(fields.containsKey('price'), isTrue);
      expect(fields['price'], isNull);
    });

    test('a given price is saved as-is', () {
      expect(ProductModel.toFirestoreFields(_product(price: 1500))['price'], 1500);
    });

    test('a stored document without a price reads back as no price', () {
      final absent = ProductModel.fromFirestore(_FakeSnapshot({'name': 'A'}));
      final nulled = ProductModel.fromFirestore(
        _FakeSnapshot({'name': 'A', 'price': null}),
      );
      expect(absent.price, isNull);
      expect(nulled.price, isNull);
    });

    test('an existing priced document keeps its price', () {
      final product = ProductModel.fromFirestore(
        _FakeSnapshot({'name': 'A', 'price': 850000, 'stockCount': 3}),
      );
      expect(product.price, 850000.0);
      expect(product.stockCount, 3);
    });

    test('price does not affect stock or availability', () {
      final unpriced = _product(stock: 4);
      final priced = _product(price: 100, stock: 4);
      expect(unpriced.stockCount, priced.stockCount);
      expect(unpriced.isAvailable, isTrue);
      expect(unpriced.maxOrderQuantity, 4);
      expect(_product(stock: 0).isAvailable, isFalse);
    });
  });

  group('marketplace card', () {
    Widget card(Product product, Locale locale) =>
        _app(Scaffold(body: ProductCard(product: product)), locale: locale);

    testWidgets('shows the price when there is one', (tester) async {
      await tester.pumpWidget(card(_product(price: 850000), _en));
      expect(find.text('850,000 SDG'), findsOneWidget);
      expect(find.text(_onRequestEn), findsNothing);
    });

    testWidgets('shows a price of 0 as 0, not as "on request"', (tester) async {
      await tester.pumpWidget(card(_product(price: 0), _en));
      expect(find.text('0 SDG'), findsOneWidget);
      expect(find.text(_onRequestEn), findsNothing);
    });

    testWidgets('shows "Price on request" in English (LTR)', (tester) async {
      await tester.pumpWidget(card(_product(), _en));
      expect(find.text(_onRequestEn), findsOneWidget);
      expect(find.textContaining('SDG'), findsNothing);
      expect(
        Directionality.of(tester.element(find.byType(ProductCard))),
        TextDirection.ltr,
      );
    });

    testWidgets('shows "السعر عند التواصل" in Arabic (RTL)', (tester) async {
      await tester.pumpWidget(card(_product(), _ar));
      expect(find.text(_onRequestAr), findsOneWidget);
      expect(find.text(_onRequestEn), findsNothing);
      expect(
        Directionality.of(tester.element(find.byType(ProductCard))),
        TextDirection.rtl,
      );
    });
  });

  group('product details', () {
    Widget details(Product product, Locale locale) => _app(
          ProductDetailsScreen(product: product),
          locale: locale,
          overrides: _detailsOverrides(product),
        );

    testWidgets('a priced product shows its price and can be bought',
        (tester) async {
      await tester.pumpWidget(details(_product(price: 1000), _en));
      await tester.pump();

      expect(find.text('1,000 SDG'), findsOneWidget);
      expect(find.text(_onRequestEn), findsNothing);
      expect(_buyButton(tester).onPressed, isNotNull);
    });

    testWidgets('an unpriced product shows "Price on request"', (tester) async {
      await tester.pumpWidget(details(_product(), _en));
      await tester.pump();

      // The price line and the (disabled) purchase button.
      expect(find.text(_onRequestEn), findsNWidgets(2));
      expect(find.textContaining('SDG'), findsNothing);
      expect(_buyButton(tester).onPressed, isNull);
    });

    testWidgets('an unpriced product still shows and uses its stock',
        (tester) async {
      await tester.pumpWidget(details(_product(stock: 4), _en));
      await tester.pump();

      expect(find.text('In Stock (4)'), findsOneWidget);
      for (var i = 0; i < 10; i++) {
        await tester.tap(find.byIcon(Icons.add));
        await tester.pump();
      }
      expect(find.text('4'), findsOneWidget);
      expect(find.text('5'), findsNothing);
    });

    testWidgets('an unpriced product shows the Arabic text in RTL',
        (tester) async {
      await tester.pumpWidget(details(_product(), _ar));
      await tester.pump();

      expect(find.text(_onRequestAr), findsNWidgets(2));
      expect(find.text(_onRequestEn), findsNothing);
      expect(
        Directionality.of(tester.element(find.byType(ProductDetailsScreen))),
        TextDirection.rtl,
      );
    });
  });

  group('company admin product form', () {
    late _RecordingRepository repository;

    setUp(() => repository = _RecordingRepository());

    Future<void> openForm(WidgetTester tester) async {
      tester.view.physicalSize = const Size(800, 3200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _app(
          Builder(
            builder: (context) => TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const ProductFormScreen.add(companyId: 'c1'),
                ),
              ),
              child: const Text('open'),
            ),
          ),
          overrides: [
            productsRepositoryProvider.overrideWithValue(repository),
            imageUploadServiceProvider.overrideWithValue(
              ImageUploadService(storage: _FakeStorage()),
            ),
            companyStreamProvider.overrideWith((ref, id) => Stream.value(null)),
          ],
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
    }

    Future<void> fill(
      WidgetTester tester, {
      required String price,
    }) async {
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Product Name'),
        'Dell Laptop',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Price (SDG) - optional'),
        price,
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Stock Quantity'),
        '4',
      );
    }

    Future<void> submit(WidgetTester tester) async {
      await tester.tap(find.widgetWithText(ElevatedButton, 'Add Product'));
      await tester.pumpAndSettle();
    }

    testWidgets('a product can be added without a price', (tester) async {
      await openForm(tester);
      await fill(tester, price: '');
      await submit(tester);

      expect(find.textContaining('price is required'), findsNothing);
      expect(repository.created, hasLength(1));
      final saved = repository.created.single;
      expect(saved.price, isNull);
      expect(saved.stockCount, 4);
    });

    testWidgets('a given price is saved', (tester) async {
      await openForm(tester);
      await fill(tester, price: '1500');
      await submit(tester);

      expect(repository.created.single.price, 1500.0);
    });

    testWidgets('a price that is given must still be greater than 0',
        (tester) async {
      await openForm(tester);
      await fill(tester, price: '0');
      await submit(tester);

      expect(find.text('Enter a valid price greater than 0.'), findsOneWidget);
      expect(repository.created, isEmpty);
    });
  });

  group('customer marketplace pipeline', () {
    Company company(String id, [String status = 'active']) => Company(
          id: id,
          name: 'Company $id',
          rating: 0,
          reviewCount: 0,
          status: status,
        );

    /// The document exactly as the Company Admin form writes it, read back the
    /// way the customer listener maps it.
    Product stored(Product product) => ProductModel.fromFirestore(
          _FakeSnapshot(ProductModel.toFirestoreFields(product)),
        );

    Product listed({double? price, String companyId = 'c1', int stock = 5}) =>
        stored(
          Product(
            id: 'p-${price ?? 'none'}-$companyId',
            name: 'Laptop',
            price: price,
            companyId: companyId,
            stockCount: stock,
          ),
        );

    List<String> visible(List<Product> products, List<Company>? companies) =>
        productsWithStock(productsOfActiveCompanies(products, companies))
            .map((p) => p.id)
            .toList();

    test('a priced product of an active company is visible', () {
      final product = listed(price: 1500);
      expect(visible([product], [company('c1')]), [product.id]);
      expect(product.price, 1500);
    });

    test('an unpriced product of an active company is visible, price still null',
        () {
      final product = listed();
      expect(visible([product], [company('c1')]), [product.id]);
      expect(product.price, isNull);
    });

    test('price plays no part: priced and unpriced products stay together', () {
      final priced = listed(price: 10);
      final unpriced = listed();
      expect(
        visible([priced, unpriced], [company('c1')]),
        [priced.id, unpriced.id],
      );
    });

    test('a product is hidden when its companyId matches no company document',
        () {
      // Ids are case-sensitive: an account linked to "C1" while the company
      // document is "c1" leaves every product it creates (priced or not)
      // without a company, so the marketplace hides it.
      final priced = listed(price: 10, companyId: 'C1');
      final unpriced = listed(companyId: 'C1');
      expect(visible([priced, unpriced], [company('c1')]), isEmpty);
    });

    test('the same products appear once the companyId matches a company', () {
      final unpriced = listed(companyId: 'c1');
      expect(visible([unpriced], [company('c1')]), [unpriced.id]);
    });

    test('a product of a non-active company stays hidden', () {
      expect(visible([listed()], [company('c1', 'pending')]), isEmpty);
    });

    test('a new product appears through the realtime stream, no restart',
        () async {
      final products = StreamController<List<Product>>();
      final companies = StreamController<List<Company>>();
      final container = ProviderContainer(
        overrides: [
          firestoreProductsStreamProvider.overrideWith((ref) => products.stream),
          firestoreCompaniesStreamProvider
              .overrideWith((ref) => companies.stream),
        ],
      );
      addTearDown(() {
        container.dispose();
        products.close();
        companies.close();
      });
      final subscription =
          container.listen(marketplaceProductsProvider, (_, _) {});
      addTearDown(subscription.close);

      // Only the products this test emits (the demo catalogue is always there).
      List<String> shown() => [
            for (final product in container.read(marketplaceProductsProvider))
              if (product.id == 'a' || product.id == 'b') product.name,
          ];

      companies.add([company('c1')]);
      products.add([
        stored(const Product(id: 'a', name: 'Priced', price: 99, companyId: 'c1')),
      ]);
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(shown(), ['Priced']);

      // The company admin then adds a product without a price.
      products.add([
        stored(const Product(id: 'b', name: 'Unpriced', companyId: 'c1')),
        stored(const Product(id: 'a', name: 'Priced', price: 99, companyId: 'c1')),
      ]);
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(shown(), ['Unpriced', 'Priced']);
      expect(
        container
            .read(marketplaceProductsProvider)
            .firstWhere((product) => product.id == 'b')
            .price,
        isNull,
      );
    });
  });
}
