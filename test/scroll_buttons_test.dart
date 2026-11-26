import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/core/widgets/back_to_top.dart';
import 'package:sudan_it_marketplace/core/widgets/jump_to_latest.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

Widget _app(Widget child) => MaterialApp(
  theme: AppTheme.light,
  locale: const Locale('ar'),
  supportedLocales: AppLocalizations.supportedLocales,
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  home: Scaffold(body: child),
);

double _opacityOf(WidgetTester tester, Key key) {
  final opacity = tester.widget<AnimatedOpacity>(
    find.ancestor(of: find.byKey(key), matching: find.byType(AnimatedOpacity)),
  );
  return opacity.opacity;
}

void main() {
  group('backToTopVisible', () {
    const vh = 800.0;
    const max = 8000.0;
    test('stays hidden in the first screen and a half', () {
      expect(backToTopVisible(was: true, pixels: 1100, last: 1300, viewport: vh, max: max), isFalse);
    });
    test('hides on the way down, shows on the way up', () {
      expect(backToTopVisible(was: true, pixels: 3000, last: 2900, viewport: vh, max: max), isFalse);
      expect(backToTopVisible(was: false, pixels: 2900, last: 3000, viewport: vh, max: max), isTrue);
    });
    test('shows near the end even while going down', () {
      expect(backToTopVisible(was: false, pixels: 7800, last: 7700, viewport: vh, max: max), isTrue);
    });
  });

  testWidgets('the back-to-top button appears on a long page and takes it to the top', (tester) async {
    final controller = ScrollController();
    await tester.pumpWidget(
      _app(
        BackToTop(
          child: ListView(
            controller: controller,
            children: [for (var i = 0; i < 200; i++) SizedBox(height: 60, child: Text('row $i'))],
          ),
        ),
      ),
    );
    expect(_opacityOf(tester, const Key('back-to-top')), 0);
    controller.jumpTo(4000);
    await tester.pump();
    controller.jumpTo(3900); // a little back up
    await tester.pumpAndSettle();
    expect(_opacityOf(tester, const Key('back-to-top')), 1);
    await tester.tap(find.byKey(const Key('back-to-top')));
    await tester.pumpAndSettle();
    expect(controller.offset, 0);
  });

  group('freshFromOthers', () {
    const items = [
      (id: 'a', mine: false),
      (id: 'b', mine: true),
      (id: 'c', mine: false),
      (id: 'd', mine: false),
    ];
    test('counts only the other side\'s messages after the last one seen', () {
      expect(freshFromOthers(items, 'a'), 2);
      expect(freshFromOthers(items, 'd'), 0);
    });
    test('nothing seen before, or an unknown id, counts nothing', () {
      expect(freshFromOthers(items, ''), 0);
      expect(freshFromOthers(items, 'zz'), 0);
    });
  });

  testWidgets('the jump button shows when reading older messages and counts new ones', (tester) async {
    final controller = ScrollController();
    var items = [for (var i = 0; i < 100; i++) (id: 'm$i', mine: false)];
    late StateSetter setItems;
    await tester.pumpWidget(
      _app(
        StatefulBuilder(
          builder: (context, setState) {
            setItems = setState;
            return JumpToLatest(
              items: items,
              child: ListView.builder(
                controller: controller,
                reverse: true,
                itemCount: items.length,
                itemBuilder: (_, i) => SizedBox(height: 60, child: Text(items[items.length - 1 - i].id)),
              ),
            );
          },
        ),
      ),
    );
    expect(_opacityOf(tester, const Key('jump-to-latest')), 0);
    controller.jumpTo(2000); // reading older messages
    await tester.pumpAndSettle();
    expect(_opacityOf(tester, const Key('jump-to-latest')), 1);

    setItems(() => items = [...items, (id: 'new1', mine: false), (id: 'new2', mine: false), (id: 'mine', mine: true)]);
    await tester.pumpAndSettle();
    expect(find.text('2'), findsOneWidget);

    await tester.tap(find.byKey(const Key('jump-to-latest')));
    await tester.pumpAndSettle();
    expect(controller.offset, 0);
    expect(find.byKey(const Key('jump-to-latest-count')), findsNothing);
  });
}
