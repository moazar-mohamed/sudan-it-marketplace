import 'helpers/field_finders.dart';
import 'dart:async';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/services/image_upload_service.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/products/product_form_screen.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/repositories/products_repository.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/widgets/product_card.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _en = Locale('en');
final _created = DateTime(2026);

Category _category(String id, String name, {bool isActive = true}) => Category(
      id: id,
      name: name,
      description: '',
      iconName: '',
      isActive: isActive,
      createdAt: _created,
    );

Widget _app(Widget home, {required List overrides}) {
  return ProviderScope(
    // ignore: argument_type_not_assignable
    overrides: overrides.cast(),
    child: MaterialApp(
      locale: _en,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [_en, Locale('ar')],
      home: home,
    ),
  );
}

class _RecordingRepository extends Fake implements ProductsRepository {
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

void main() {
  group('product form category selector', () {
    late _RecordingRepository repository;

    setUp(() => repository = _RecordingRepository());

    List overrides({Stream<List<Category>>? categoryStream}) => [
          productsRepositoryProvider.overrideWithValue(repository),
          imageUploadServiceProvider
              .overrideWithValue(ImageUploadService(storage: _FakeStorage())),
          companyStreamProvider.overrideWith((ref, id) => Stream.value(null)),
          allCategoriesProvider.overrideWith(
            (ref) =>
                categoryStream ??
                Stream.value([
                  _category('cat1', 'Electronics'),
                  _category('cat2', 'Home Appliances'),
                  _category('cat3', 'Retired Category', isActive: false),
                ]),
          ),
        ];

    Future<void> pumpAdd(WidgetTester tester) async {
      tester.view.physicalSize = const Size(800, 3200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _app(
          const ProductFormScreen.add(companyId: 'c1'),
          overrides: overrides(),
        ),
      );
      await tester.pumpAndSettle();
    }

    Future<void> fillRequiredFields(WidgetTester tester) async {
      await tester.enterText(
        fieldWithLabel('Product Name'),
        'Router',
      );
      await tester.enterText(
        fieldWithLabel('Stock Quantity'),
        '5',
      );
    }

    testWidgets('only active categories are offered when adding a product',
        (tester) async {
      await pumpAdd(tester);

      await tester.tap(find.byType(DropdownButtonFormField<String?>));
      await tester.pumpAndSettle();

      expect(find.text('Electronics'), findsOneWidget);
      expect(find.text('Home Appliances'), findsOneWidget);
      expect(find.textContaining('Retired Category'), findsNothing);
    });

    testWidgets('selecting a category stores its id on the new product',
        (tester) async {
      await pumpAdd(tester);
      await fillRequiredFields(tester);

      await tester.tap(find.byType(DropdownButtonFormField<String?>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Electronics').last);
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(FilledButton, 'Add Product'));
      await tester.pumpAndSettle();

      expect(repository.created, hasLength(1));
      expect(repository.created.single.categoryId, 'cat1');
    });

    testWidgets('a product can still be added with no category selected',
        (tester) async {
      await pumpAdd(tester);
      await fillRequiredFields(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Add Product'));
      await tester.pumpAndSettle();

      expect(repository.created, hasLength(1));
      expect(repository.created.single.categoryId, isNull);
    });

    testWidgets('a chosen category can be cleared with "No category"',
        (tester) async {
      final product = Product(
        id: 'p1',
        name: 'Router',
        companyId: 'c1',
        companyName: 'Nile Tech',
        categoryId: 'cat1',
        stockCount: 2,
      );
      tester.view.physicalSize = const Size(800, 3200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _app(
          ProductFormScreen.edit(product: product),
          overrides: overrides(),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Electronics'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('No category').last);
      await tester.pumpAndSettle();

      await tester.ensureVisible(
        find.widgetWithText(FilledButton, 'Save changes'),
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Save changes'));
      await tester.pumpAndSettle();

      expect(repository.updated.single.categoryId, isNull);
    });

    testWidgets('editing while categories are still loading does not crash',
        (tester) async {
      final product = Product(
        id: 'p1',
        name: 'Router',
        companyId: 'c1',
        companyName: 'Nile Tech',
        categoryId: 'cat1',
        stockCount: 2,
      );
      tester.view.physicalSize = const Size(800, 3200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      final categories = StreamController<List<Category>>();
      addTearDown(() {
        categories.close();
      });
      await tester.pumpWidget(
        _app(
          ProductFormScreen.edit(product: product),
          overrides: overrides(categoryStream: categories.stream),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);

      // Firestore's cache can answer with an empty snapshot before the server.
      categories.add(const []);
      await tester.pump();
      expect(tester.takeException(), isNull);

      categories.add([_category('cat1', 'Electronics')]);
      await tester.pumpAndSettle();
      expect(find.text('Electronics'), findsOneWidget);
    });

    testWidgets(
        'editing a product keeps its now-deactivated category visible and unchanged',
        (tester) async {
      final product = Product(
        id: 'p1',
        name: 'Old Router',
        companyId: 'c1',
        companyName: 'Nile Tech',
        categoryId: 'cat3',
        stockCount: 2,
      );
      tester.view.physicalSize = const Size(800, 3200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _app(
          ProductFormScreen.edit(product: product),
          overrides: overrides(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Retired Category'), findsOneWidget);
      expect(find.textContaining('(inactive)'), findsOneWidget);

      await tester.ensureVisible(
        find.widgetWithText(FilledButton, 'Save changes'),
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Save changes'));
      await tester.pumpAndSettle();

      expect(repository.updated, hasLength(1));
      expect(repository.updated.single.categoryId, 'cat3');
    });
  });

  group('product card category label', () {
    Product product() => const Product(
          id: 'p1',
          name: 'Router',
          categoryId: 'cat1',
          stockCount: 5,
        );

    testWidgets('shows the category name when one is given', (tester) async {
      await tester.pumpWidget(
        _app(
          Scaffold(
            body: ProductCard(product: product(), categoryName: 'Electronics'),
          ),
          overrides: const [],
        ),
      );

      expect(find.text('Electronics'), findsOneWidget);
    });

    testWidgets('shows nothing extra when no category name is given',
        (tester) async {
      await tester.pumpWidget(
        _app(
          Scaffold(body: ProductCard(product: product())),
          overrides: const [],
        ),
      );

      expect(find.text('Electronics'), findsNothing);
    });
  });
}
