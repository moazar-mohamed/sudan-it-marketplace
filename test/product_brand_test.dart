import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/services/image_upload_service.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_picker.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/products/product_form_screen.dart';
import 'package:sudan_it_marketplace/features/products/data/models/product_model.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/repositories/products_repository.dart';
import 'package:sudan_it_marketplace/features/products/presentation/product_details_screen.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

import 'helpers/field_finders.dart';

// A minimal stand-in so ProductModel.fromFirestore can be tested without Firebase.
// ignore: subtype_of_sealed_class
class _Snapshot extends Fake
    implements DocumentSnapshot<Map<String, dynamic>> {
  _Snapshot(this._data);

  final Map<String, dynamic> _data;

  @override
  String get id => 'p1';

  @override
  Map<String, dynamic>? data() => _data;
}

class _Repository extends Fake implements ProductsRepository {
  final created = <Product>[];
  final updated = <Product>[];

  @override
  String newProductId() => 'new1';

  @override
  Future<void> createProduct(Product product) async => created.add(product);

  @override
  Future<void> updateProduct(Product product) async => updated.add(product);
}

class _FakeStorage extends Fake implements FirebaseStorage {}

final _category = Category(
  id: 'cat1',
  name: 'Printers',
  description: '',
  iconName: '',
  isActive: true,
  createdAt: DateTime(2026),
);

Product _existing(String id, String brand) => Product(
  id: id,
  name: 'Existing $id',
  brand: brand,
  companyId: 'c9',
  companyName: 'Other',
  categoryId: 'cat1',
  stockCount: 3,
);

void main() {
  group('the brand of a product', () {
    test('is stored trimmed, and an empty one is stored as empty', () {
      final fields = ProductModel.toFirestoreFields(
        const Product(id: 'p1', name: 'A', brand: '  HP '),
      );
      expect(fields['brand'], 'HP');
      expect(
        ProductModel.toFirestoreFields(const Product(id: 'p2', name: 'B'))['brand'],
        '',
      );
    });

    test('is read back, and an older product has none', () {
      expect(
        ProductModel.fromFirestore(_Snapshot({'name': 'A', 'brand': ' Dell '})).brand,
        'Dell',
      );
      expect(ProductModel.fromFirestore(_Snapshot({'name': 'A'})).brand, '');
    });

    test('survives a stock or offer change', () {
      const product = Product(id: 'p1', name: 'A', brand: 'HP', price: 10);
      expect(product.withStockCount(2).brand, 'HP');
      expect(product.withOffer(5, DateTime(2030)).brand, 'HP');
    });
  });

  group('the product form', () {
    late _Repository repository;
    setUp(() => repository = _Repository());

    List overrides({List<Product> marketplace = const []}) => [
      productsRepositoryProvider.overrideWithValue(repository),
      imageUploadServiceProvider.overrideWithValue(
        ImageUploadService(storage: _FakeStorage()),
      ),
      companyStreamProvider.overrideWith((ref, id) => Stream.value(null)),
      allCategoriesProvider.overrideWith((ref) => Stream.value([_category])),
      marketplaceProductsProvider.overrideWithValue(marketplace),
    ];

    Future<void> pump(
      WidgetTester tester, {
      Widget form = const ProductFormScreen.add(companyId: 'c1'),
      List<Product> marketplace = const [],
    }) async {
      tester.view.physicalSize = const Size(800, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: overrides(marketplace: marketplace).cast(),
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: const [Locale('en'), Locale('ar')],
            home: form,
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    Future<void> fillAndSave(WidgetTester tester, {String? brand}) async {
      await tester.enterText(fieldWithLabel('Product Name'), 'LaserJet');
      if (brand != null) {
        await tester.enterText(fieldWithLabel('Brand'), brand);
      }
      await tester.enterText(fieldWithLabel('Stock Quantity'), '5');
      await tester.tap(find.byType(CategoryPickerField));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Printers').last);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Add Product'));
      await tester.pumpAndSettle();
    }

    testWidgets('can be typed and is saved on the product', (tester) async {
      await pump(tester);
      await fillAndSave(tester, brand: ' HP ');
      expect(repository.created.single.brand, 'HP');
    });

    testWidgets('is optional', (tester) async {
      await pump(tester);
      await fillAndSave(tester);
      expect(repository.created.single.brand, '');
    });

    testWidgets('offers the brands already on the marketplace', (tester) async {
      await pump(
        tester,
        marketplace: [_existing('a', 'Cisco'), _existing('b', 'cisco'), _existing('c', 'HP')],
      );
      // Each brand once, however it was spelled.
      expect(find.byKey(const ValueKey('brand-suggestion-Cisco')), findsOneWidget);
      expect(find.byKey(const ValueKey('brand-suggestion-HP')), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('brand-suggestion-Cisco')));
      await tester.pumpAndSettle();
      await fillAndSave(tester);
      expect(repository.created.single.brand, 'Cisco');
    });

    testWidgets('narrows the suggestions to what is typed', (tester) async {
      await pump(
        tester,
        marketplace: [_existing('a', 'Cisco'), _existing('c', 'HP')],
      );
      await tester.enterText(fieldWithLabel('Brand'), 'ci');
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('brand-suggestion-Cisco')), findsOneWidget);
      expect(find.byKey(const ValueKey('brand-suggestion-HP')), findsNothing);
    });

    testWidgets('is kept when a product is edited', (tester) async {
      final product = Product(
        id: 'p1',
        name: 'Router',
        brand: 'Tenda',
        companyId: 'c1',
        companyName: 'Nile',
        categoryId: 'cat1',
        stockCount: 2,
      );
      await pump(tester, form: ProductFormScreen.edit(product: product));
      expect(find.text('Tenda'), findsOneWidget);
      await tester.ensureVisible(find.widgetWithText(FilledButton, 'Save changes'));
      await tester.tap(find.widgetWithText(FilledButton, 'Save changes'));
      await tester.pumpAndSettle();
      expect(repository.updated.single.brand, 'Tenda');
    });
  });

  testWidgets('the product page shows the brand', (tester) async {
    tester.view.physicalSize = const Size(800, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          allCategoriesProvider.overrideWith((ref) => Stream.value([_category])),
          companyStreamProvider.overrideWith((ref, id) => Stream.value(null)),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: const [Locale('en'), Locale('ar')],
          home: ProductDetailsScreen(
            product: const Product(
              id: 'p1',
              name: 'LaserJet',
              brand: 'HP',
              price: 100,
              companyId: 'c1',
              companyName: 'Nile',
              categoryId: 'cat1',
              stockCount: 3,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('product-brand')), findsOneWidget);
    expect(find.text('HP'), findsOneWidget);
  });
}
