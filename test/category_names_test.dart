import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/localization/locale_controller.dart';
import 'package:sudan_it_marketplace/features/categories/data/models/category_model.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/categories/presentation/category_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/category_grid.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

Category _category(
  String id,
  String name, {
  String nameAr = '',
  String nameEn = '',
  int? sortOrder,
}) =>
    Category(
      id: id,
      name: name,
      nameAr: nameAr,
      nameEn: nameEn,
      sortOrder: sortOrder,
      description: '',
      iconName: '',
      isActive: true,
      createdAt: DateTime(2026),
    );

void main() {
  final laptops = _category('k1', 'Laptops', nameAr: 'لابتوب', nameEn: 'Laptops');

  group('a category name in two languages', () {
    test('is chosen by the language', () {
      expect(laptops.nameFor('ar'), 'لابتوب');
      expect(laptops.nameFor('en'), 'Laptops');
    });

    test('falls back to the single old name', () {
      final legacy = _category('k2', 'Printers');
      expect(legacy.nameFor('ar'), 'Printers');
      expect(legacy.nameFor('en'), 'Printers');
      final onlyEnglish = _category('k3', 'Cables', nameEn: 'Cables');
      expect(onlyEnglish.nameFor('ar'), 'Cables');
      expect(_category('k4', 'X', nameAr: '  ').nameFor('ar'), 'X');
    });

    test('can be searched in either language', () {
      expect(laptops.searchText, contains('لابتوب'));
      expect(laptops.searchText, contains('Laptops'));
    });

    test('is read from and written to Firestore only when present', () {
      final read = CategoryModel.fromMap('k1', {
        'name': 'Laptops',
        'nameAr': 'لابتوب',
        'nameEn': 'Laptops',
        'sortOrder': 3,
        'description': '',
        'iconName': '',
        'isActive': true,
      });
      expect(read.nameAr, 'لابتوب');
      expect(read.sortOrder, 3);
      expect(read.toFirestoreMap()['sortOrder'], 3);

      final legacy = CategoryModel.fromMap('k2', {'name': 'Printers'});
      expect(legacy.nameAr, '');
      expect(legacy.sortOrder, isNull);
      expect(legacy.toFirestoreMap().containsKey('nameAr'), isFalse);
      expect(legacy.toFirestoreMap().containsKey('sortOrder'), isFalse);
    });
  });

  group('the order of categories', () {
    test('positioned ones come first, then the rest by name', () {
      final list = [
        _category('c', 'Zeta'),
        _category('b', 'Beta', sortOrder: 1),
        _category('a', 'Alpha'),
        _category('d', 'Delta', sortOrder: 0),
      ]..sort(compareCategories);
      expect(list.map((c) => c.id), ['d', 'b', 'a', 'c']);
    });
  });

  group('on screen', () {
    Widget app(Locale locale, Widget child) => ProviderScope(
          child: MaterialApp(
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: const [Locale('en'), Locale('ar')],
            home: Scaffold(body: child),
          ),
        );

    testWidgets('the grid shows the Arabic name to Arabic users',
        (tester) async {
      await tester.pumpWidget(
        app(
          const Locale('ar'),
          CategoryGrid(categories: [laptops], selectedId: null, onSelected: (_) {}),
        ),
      );
      expect(find.text('لابتوب'), findsOneWidget);
      expect(find.text('Laptops'), findsNothing);
    });

    testWidgets('and the English name to English users', (tester) async {
      await tester.pumpWidget(
        app(
          const Locale('en'),
          CategoryGrid(categories: [laptops], selectedId: null, onSelected: (_) {}),
        ),
      );
      expect(find.text('Laptops'), findsOneWidget);
      expect(find.text('لابتوب'), findsNothing);
    });

    test('category names by id follow the app language', () async {
      final container = ProviderContainer(
        overrides: [
          allCategoriesProvider.overrideWith((ref) => Stream.value([laptops])),
        ],
      );
      addTearDown(container.dispose);
      // Keep the providers alive while the stream delivers its first value.
      container.listen(categoryNamesProvider, (_, _) {});
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      expect(container.read(categoryNamesProvider)['k1'], 'Laptops');
      await container
          .read(localeControllerProvider.notifier)
          .setLocale(const Locale('ar'));
      expect(container.read(categoryNamesProvider)['k1'], 'لابتوب');
    });
  });
}
