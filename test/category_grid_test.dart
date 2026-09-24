import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/categories/domain/entities/category.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/category_grid.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

Category _category(String id, String name, {String iconName = ''}) => Category(
      id: id,
      name: name,
      description: '',
      iconName: iconName,
      isActive: true,
      createdAt: DateTime(2026),
    );

Widget _app(Widget child, {Locale locale = const Locale('en')}) => MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: Scaffold(body: SingleChildScrollView(child: child)),
    );

void main() {
  final many = [
    for (var i = 1; i <= 11; i++) _category('c$i', 'Category $i'),
  ];

  group('the categories section', () {
    testWidgets('shows the first eight tiles and a More link', (tester) async {
      await tester.pumpWidget(
        _app(CategoryGrid(categories: many, selectedId: null, onSelected: (_) {})),
      );

      expect(find.text('Categories'), findsOneWidget);
      expect(find.text('Category 1'), findsOneWidget);
      expect(find.text('Category 8'), findsOneWidget);
      expect(find.text('Category 9'), findsNothing);
      expect(find.text('More'), findsOneWidget);
    });

    testWidgets('has no More link when everything fits', (tester) async {
      await tester.pumpWidget(
        _app(
          CategoryGrid(
            categories: many.take(5).toList(),
            selectedId: null,
            onSelected: (_) {},
          ),
        ),
      );
      expect(find.text('More'), findsNothing);
    });

    testWidgets('tapping a tile selects it, tapping it again clears it',
        (tester) async {
      final picked = <String?>[];
      String? selected;
      await tester.pumpWidget(
        StatefulBuilder(
          builder: (context, setState) => _app(
            CategoryGrid(
              categories: many.take(4).toList(),
              selectedId: selected,
              onSelected: (id) {
                picked.add(id);
                setState(() => selected = id);
              },
            ),
          ),
        ),
      );

      await tester.tap(find.text('Category 2'));
      await tester.pump();
      expect(picked, ['c2']);
      // While one is selected the header offers "All" to clear it.
      expect(find.text('All'), findsOneWidget);

      await tester.tap(find.text('Category 2'));
      await tester.pump();
      expect(picked, ['c2', null]);
      expect(find.text('All'), findsNothing);
    });

    testWidgets('More opens every category, and picking one selects it',
        (tester) async {
      String? picked;
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        _app(
          CategoryGrid(
            categories: many,
            selectedId: null,
            onSelected: (id) => picked = id,
          ),
        ),
      );

      await tester.tap(find.text('More'));
      await tester.pumpAndSettle();
      expect(find.text('Category 11'), findsOneWidget);

      await tester.tap(find.text('Category 11'));
      await tester.pumpAndSettle();
      expect(picked, 'c11');
    });

    testWidgets('a selected category hidden behind More still shows selected',
        (tester) async {
      await tester.pumpWidget(
        _app(CategoryGrid(categories: many, selectedId: 'c10', onSelected: (_) {})),
      );
      expect(find.text('Category 10'), findsOneWidget);
      expect(find.text('Category 8'), findsNothing);
    });

    testWidgets('is right-to-left and translated in Arabic', (tester) async {
      await tester.pumpWidget(
        _app(
          CategoryGrid(
            categories: [_category('a', 'لابتوب وكمبيوتر')],
            selectedId: null,
            onSelected: (_) {},
          ),
          locale: const Locale('ar'),
        ),
      );
      expect(find.text('الأقسام'), findsOneWidget);
      expect(find.text('لابتوب وكمبيوتر'), findsOneWidget);
    });
  });

  group('the icon of a category', () {
    IconData icon(String name, {String iconName = ''}) =>
        categoryIconFor(_category('x', name, iconName: iconName));

    test('follows the icon name set by the platform admin', () {
      expect(icon('Anything', iconName: 'router'), Icons.router_outlined);
      expect(icon('Anything', iconName: ' Camera '), Icons.videocam_outlined);
    });

    test('is guessed from the name in English and Arabic', () {
      expect(icon('Laptops'), Icons.laptop_mac);
      expect(icon('لابتوب وكمبيوتر'), Icons.laptop_mac);
      expect(icon('الطابعات'), Icons.print_outlined);
      expect(icon('Network equipment'), Icons.lan_outlined);
      expect(icon('كاميرات مراقبة'), Icons.videocam_outlined);
    });

    test('falls back to a generic icon', () {
      expect(icon('Misc'), Icons.category_outlined);
      expect(icon('Groups'), Icons.category_outlined);
    });
  });
}
