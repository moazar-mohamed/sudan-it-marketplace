import 'dart:async';
import 'dart:io';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/services/image_upload_service.dart';
import 'package:sudan_it_marketplace/features/categories/domain/category_tree.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_picker.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/products/product_form_screen.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/repositories/products_repository.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

import 'helpers/field_finders.dart';

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

/// Products: Networking > Routers > Wi-Fi 6 ; Networking > Switches ; Laptops.
/// Installation > Cabling. A retired category with a child. Products and
/// services share the one tree.
List<Category> _tree() => [
  _c('net', null, 'Networking', ar: 'شبكات', sortOrder: 0),
  _c('rou', 'net', 'Routers', ar: 'راوترات', sortOrder: 0),
  _c('wifi', 'rou', 'Wi-Fi 6', ar: 'واي فاي'),
  _c('swi', 'net', 'Switches', ar: 'سويتشات', sortOrder: 1),
  _c('lap', null, 'Laptops', ar: 'لابتوبات', sortOrder: 1),
  _c('ret', null, 'Retired', isActive: false, sortOrder: 2),
  _c('ret1', 'ret', 'Under Retired'),
  _c('ins', null, 'Installation'),
  _c('cab', 'ins', 'Cabling'),
];

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

void main() {
  late _Repository repository;
  setUp(() => repository = _Repository());

  Future<void> pumpForm(
    WidgetTester tester, {
    Widget? form,
    Stream<List<Category>>? categories,
    Locale locale = const Locale('en'),
  }) async {
    tester.view.physicalSize = const Size(800, 3200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          productsRepositoryProvider.overrideWithValue(repository),
          imageUploadServiceProvider.overrideWithValue(
            ImageUploadService(storage: _FakeStorage()),
          ),
          companyStreamProvider.overrideWith((ref, id) => Stream.value(null)),
          allCategoriesProvider.overrideWith(
            (ref) => categories ?? Stream.value(_tree()),
          ),
        ],
        child: MaterialApp(
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: const [Locale('en'), Locale('ar')],
          home: form ?? const ProductFormScreen.add(companyId: 'c1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> openPicker(WidgetTester tester) async {
    await tester.tap(find.byType(CategoryPickerField));
    await tester.pumpAndSettle();
  }

  Future<void> tapKey(WidgetTester tester, String key) async {
    await tester.tap(find.byKey(ValueKey(key)));
    await tester.pumpAndSettle();
  }

  Future<void> save(WidgetTester tester, {String label = 'Add Product'}) async {
    await tester.enterText(fieldWithLabel('Product Name'), 'Router');
    await tester.enterText(fieldWithLabel('Stock Quantity'), '5');
    await tester.tap(find.widgetWithText(FilledButton, label));
    await tester.pumpAndSettle();
  }

  group('a company chooses a product category from Platform Admin\'s tree', () {
    testWidgets('starts at the top level and only shows what is available', (
      tester,
    ) async {
      await pumpForm(tester);
      await openPicker(tester);

      // the top level of the one shared tree, active only
      expect(find.byKey(const ValueKey('category-row-net')), findsOneWidget);
      expect(find.byKey(const ValueKey('category-row-lap')), findsOneWidget);
      // deeper levels are not listed yet
      expect(find.byKey(const ValueKey('category-row-rou')), findsNothing);
      expect(find.byKey(const ValueKey('category-row-wifi')), findsNothing);
      // a deactivated category (and everything under it) is not offered
      expect(find.text('Retired'), findsNothing);
      expect(find.text('Under Retired'), findsNothing);
      // the same tree a service is filed in: its top level is offered too
      expect(find.byKey(const ValueKey('category-row-ins')), findsOneWidget);
      expect(find.byKey(const ValueKey('category-row-cab')), findsNothing);
      // "No category" is still an option
      expect(find.byKey(const ValueKey('category-none')), findsOneWidget);
    });

    testWidgets('walks down level by level and chooses the final category', (
      tester,
    ) async {
      await pumpForm(tester);
      await openPicker(tester);
      await tapKey(tester, 'category-row-net'); // has sub-categories: opens
      expect(find.byKey(const ValueKey('category-row-rou')), findsOneWidget);
      expect(find.byKey(const ValueKey('category-row-swi')), findsOneWidget);
      expect(
        find.byKey(const ValueKey('category-row-lap')),
        findsNothing,
      ); // another branch
      await tapKey(tester, 'category-row-rou');
      expect(find.byKey(const ValueKey('category-row-wifi')), findsOneWidget);
      await tapKey(tester, 'category-row-wifi'); // a leaf: chosen at once

      // the field shows the whole path
      expect(find.text('Networking › Routers › Wi-Fi 6'), findsOneWidget);
      await save(tester);
      expect(repository.created.single.categoryId, 'wifi');
    });

    testWidgets(
      'can choose a category that has sub-categories, without going deeper',
      (tester) async {
        await pumpForm(tester);
        await openPicker(tester);
        await tapKey(tester, 'category-select-net');
        expect(find.text('Networking'), findsOneWidget);
        await save(tester);
        expect(repository.created.single.categoryId, 'net');
      },
    );

    testWidgets('the breadcrumb goes back up the tree', (tester) async {
      await pumpForm(tester);
      await openPicker(tester);
      await tapKey(tester, 'category-row-net');
      await tapKey(tester, 'category-row-rou');
      expect(find.byKey(const ValueKey('category-crumb-net')), findsOneWidget);
      await tapKey(tester, 'category-crumb-net');
      expect(find.byKey(const ValueKey('category-row-swi')), findsOneWidget);
      await tapKey(tester, 'category-crumb-root');
      expect(find.byKey(const ValueKey('category-row-lap')), findsOneWidget);
    });

    testWidgets(
      'finds a category by its Arabic or English name and chooses it',
      (tester) async {
        await pumpForm(tester);
        await openPicker(tester);
        await tester.enterText(
          find.byKey(const ValueKey('category-search')).last,
          'wi-fi',
        );
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('category-result-wifi')),
          findsOneWidget,
        );
        expect(
          find.text('Networking › Routers › Wi-Fi 6'),
          findsOneWidget,
        ); // its place in the tree
        await tester.enterText(find.byType(TextField).last, 'راوتر');
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('category-result-rou')),
          findsOneWidget,
        );
        await tester.enterText(find.byType(TextField).last, 'nothing here');
        await tester.pumpAndSettle();
        expect(find.text('No category matches your search.'), findsOneWidget);
        await tester.enterText(find.byType(TextField).last, 'wi-fi');
        await tester.pumpAndSettle();
        await tapKey(tester, 'category-result-wifi');
        await save(tester);
        expect(repository.created.single.categoryId, 'wifi');
      },
    );

    testWidgets(
      'a category deactivated by Platform Admin cannot be found or chosen',
      (tester) async {
        await pumpForm(tester);
        await openPicker(tester);
        await tester.enterText(find.byType(TextField).last, 'under retired');
        await tester.pumpAndSettle();
        expect(find.text('No category matches your search.'), findsOneWidget);
      },
    );

    testWidgets('works at any depth: 12 levels down', (tester) async {
      final chain = [
        for (var i = 0; i < 12; i++)
          _c('l$i', i == 0 ? null : 'l${i - 1}', 'Level $i'),
      ];
      await pumpForm(tester, categories: Stream.value(chain));
      await openPicker(tester);
      for (var i = 0; i < 11; i++) {
        await tapKey(tester, 'category-row-l$i');
      }
      await tapKey(tester, 'category-row-l11');
      expect(find.textContaining('Level 0 › Level 1'), findsOneWidget);
      expect(find.textContaining('Level 11'), findsOneWidget);
      await save(tester);
      expect(repository.created.single.categoryId, 'l11');
    });

    testWidgets('"No category" clears the choice', (tester) async {
      await pumpForm(tester);
      await openPicker(tester);
      await tapKey(tester, 'category-row-lap');
      expect(find.text('Laptops'), findsOneWidget);
      await openPicker(tester);
      await tapKey(tester, 'category-none');
      await save(tester);
      expect(repository.created.single.categoryId, isNull);
    });

    testWidgets('dismissing the sheet leaves the choice unchanged', (
      tester,
    ) async {
      await pumpForm(tester);
      await openPicker(tester);
      await tapKey(tester, 'category-row-lap');
      await openPicker(tester);
      await tester.tapAt(const Offset(10, 10)); // outside the sheet
      await tester.pumpAndSettle();
      expect(find.text('Laptops'), findsOneWidget);
    });

    testWidgets(
      'a new category added by Platform Admin appears without restarting the app',
      (tester) async {
        final feed = StreamController<List<Category>>();
        addTearDown(feed.close);
        feed.add(_tree());
        await pumpForm(tester, categories: feed.stream);
        await openPicker(tester);
        expect(find.text('Printers'), findsNothing);
        await tester.tapAt(const Offset(10, 10));
        await tester.pumpAndSettle();

        feed.add([
          ..._tree(),
          _c('prn', null, 'Printers', ar: 'طابعات', sortOrder: 5),
          _c('prn1', 'prn', 'Laser'),
        ]);
        await tester.pumpAndSettle();

        await openPicker(tester);
        expect(find.byKey(const ValueKey('category-row-prn')), findsOneWidget);
        await tapKey(tester, 'category-row-prn');
        await tapKey(tester, 'category-row-prn1');
        expect(find.text('Printers › Laser'), findsOneWidget);
      },
    );

    testWidgets('a category moved by Platform Admin shows in its new place', (
      tester,
    ) async {
      final feed = StreamController<List<Category>>();
      addTearDown(feed.close);
      feed.add(_tree());
      await pumpForm(tester, categories: feed.stream);
      // Switches moves from Networking to the top level
      feed.add(
        _tree()
            .map(
              (c) => c.id == 'swi'
                  ? _c('swi', null, 'Switches', ar: 'سويتشات')
                  : c,
            )
            .toList(),
      );
      await tester.pumpAndSettle();
      await openPicker(tester);
      expect(find.byKey(const ValueKey('category-row-swi')), findsOneWidget);
      await tapKey(tester, 'category-row-net');
      expect(find.byKey(const ValueKey('category-row-swi')), findsNothing);
    });

    testWidgets('names and breadcrumb are in Arabic, right to left', (
      tester,
    ) async {
      await pumpForm(tester, locale: const Locale('ar'));
      await openPicker(tester);
      expect(find.text('شبكات'), findsOneWidget);
      expect(find.text('كل التصنيفات'), findsOneWidget);
      await tapKey(tester, 'category-row-net');
      await tapKey(tester, 'category-row-rou');
      await tapKey(tester, 'category-row-wifi');
      expect(find.text('شبكات › راوترات › واي فاي'), findsOneWidget);
    });
  });

  group('editing a product', () {
    Product product(String? categoryId) => Product(
      id: 'p1',
      name: 'Router',
      companyId: 'c1',
      companyName: 'Nile Tech',
      categoryId: categoryId,
      stockCount: 2,
    );

    testWidgets(
      'shows the whole path of its category, and reopens at that level',
      (tester) async {
        await pumpForm(
          tester,
          form: ProductFormScreen.edit(product: product('wifi')),
        );
        expect(find.text('Networking › Routers › Wi-Fi 6'), findsOneWidget);
        await openPicker(tester);
        // opens where the choice is: the Routers level, with the choice ticked
        expect(find.byKey(const ValueKey('category-row-wifi')), findsOneWidget);
        expect(
          find.byKey(const ValueKey('category-crumb-rou')),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'a category that is no longer available says so and is kept unless changed',
      (tester) async {
        await pumpForm(
          tester,
          form: ProductFormScreen.edit(product: product('deleted')),
        );
        expect(
          find.text(
            'This category is no longer available. Choose another one.',
          ),
          findsOneWidget,
        );
        await tester.ensureVisible(
          find.widgetWithText(FilledButton, 'Save changes'),
        );
        await tester.tap(find.widgetWithText(FilledButton, 'Save changes'));
        await tester.pumpAndSettle();
        expect(
          repository.updated.single.categoryId,
          'deleted',
        ); // unchanged, as before
      },
    );

    testWidgets('a category whose parent was deactivated shows as inactive', (
      tester,
    ) async {
      await pumpForm(
        tester,
        form: ProductFormScreen.edit(product: product('ret1')),
      );
      expect(find.textContaining('Retired › Under Retired'), findsOneWidget);
      expect(find.textContaining('(inactive)'), findsOneWidget);
    });
  });

  group('the picker on its own', () {
    Future<CategoryPick?> show(
      WidgetTester tester,
      CategoryTree tree, {
      String? selectedId,
      bool allowNone = true,
    }) async {
      CategoryPick? result;
      var done = false;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: const [Locale('en'), Locale('ar')],
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () async {
                  result = await showCategoryPicker(
                    context,
                    tree: tree,
                    selectedId: selectedId,
                    allowNone: allowNone,
                  );
                  done = true;
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      addTearDown(() => expect(done || result == null, isTrue));
      return result;
    }

    testWidgets('an empty tree says there is nothing to choose', (
      tester,
    ) async {
      await show(tester, CategoryTree(const []), allowNone: false);
      expect(find.text('No categories have been added yet.'), findsOneWidget);
      expect(find.byKey(const ValueKey('category-none')), findsNothing);
    });

    testWidgets('services choose from the same tree as products', (
      tester,
    ) async {
      await show(tester, CategoryTree(_tree()), allowNone: false);
      expect(find.byKey(const ValueKey('category-row-ins')), findsOneWidget);
      expect(find.byKey(const ValueKey('category-row-net')), findsOneWidget);
      expect(find.byKey(const ValueKey('category-row-lap')), findsOneWidget);
    });

    testWidgets('older categories (no parent) are offered as top-level ones', (
      tester,
    ) async {
      final categories = [_c('old', null, 'Legacy')];
      await show(tester, CategoryTree(categories));
      expect(find.byKey(const ValueKey('category-row-old')), findsOneWidget);
      await tester.tapAt(const Offset(10, 10));
      await tester.pumpAndSettle();
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
    });
  });

  group('companies cannot manage categories', () {
    test('nothing in the company app writes to categories', () {
      final sources = [
        for (final entity in Directory(
          'lib/features/company_admin',
        ).listSync(recursive: true))
          if (entity is File && entity.path.endsWith('.dart')) entity,
        for (final entity in Directory(
          'lib/features/categories',
        ).listSync(recursive: true))
          if (entity is File &&
              entity.path.endsWith('.dart') &&
              entity.path.contains('presentation'))
            entity,
      ];
      expect(sources, isNotEmpty);
      for (final file in sources) {
        final text = file.readAsStringSync();
        for (final forbidden in [
          'createCategory',
          'updateCategory',
          'setCategoryActive',
          'deleteCategory',
          "collection('categories')",
        ]) {
          expect(
            text.contains(forbidden),
            isFalse,
            reason: '${file.path} uses $forbidden',
          );
        }
      }
    });
  });
}
