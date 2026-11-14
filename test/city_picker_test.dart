import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/cities/presentation/city_picker_sheets.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

/// Opens the sheet from a button and returns what it popped.
Future<String?> _open(
  WidgetTester tester, {
  Locale locale = const Locale('en'),
  Map<String, int> counts = const {},
  Set<String>? enabledIds,
  Future<void> Function()? afterOpen,
}) async {
  String? result;
  var done = false;
  await tester.pumpWidget(
    MaterialApp(
      locale: locale,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () async {
                result = await showCityPickerSheet(
                  context,
                  counts: counts,
                  enabledIds: enabledIds,
                );
                done = true;
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  if (afterOpen != null) {
    await afterOpen();
  }
  if (!done) {
    return null;
  }
  return result;
}

void main() {
  group('city picker sheet', () {
    testWidgets('choosing a city returns its id', (tester) async {
      final picked = await _open(
        tester,
        afterOpen: () async {
          await tester.tap(find.byKey(const ValueKey('city-kassala')));
          await tester.pumpAndSettle();
        },
      );
      expect(picked, 'kassala');
      expect(find.byKey(const ValueKey('city-kassala')), findsNothing);
    });

    testWidgets('search narrows the list in Arabic and English', (tester) async {
      await _open(
        tester,
        afterOpen: () async {
          await tester.enterText(find.byKey(const ValueKey('city-search')), 'port');
          await tester.pumpAndSettle();
          expect(find.byKey(const ValueKey('city-port_sudan')), findsOneWidget);
          expect(find.byKey(const ValueKey('city-kassala')), findsNothing);
          await tester.enterText(find.byKey(const ValueKey('city-search')), 'zzz');
          await tester.pumpAndSettle();
          expect(find.text('No city matches your search.'), findsOneWidget);
          await tester.enterText(find.byKey(const ValueKey('city-search')), 'كسلا');
          await tester.pumpAndSettle();
          expect(find.byKey(const ValueKey('city-kassala')), findsOneWidget);
        },
      );
    });

    testWidgets('shows how many companies serve each city', (tester) async {
      await _open(
        tester,
        counts: {'khartoum': 3},
        afterOpen: () async {
          expect(find.text('3 companies'), findsOneWidget);
        },
      );
    });

    testWidgets('cities the company does not serve are faded and cannot be chosen',
        (tester) async {
      final picked = await _open(
        tester,
        enabledIds: {'port_sudan', 'kassala'},
        afterOpen: () async {
          expect(
            find.text('This company does not serve it'),
            findsWidgets,
          );
          // The list is long: the served city must still be reachable.
          await tester.tap(find.byKey(const ValueKey('city-khartoum')));
          await tester.pumpAndSettle();
          expect(find.byKey(const ValueKey('city-khartoum')), findsOneWidget);
          await tester.tap(find.byKey(const ValueKey('city-kassala')));
          await tester.pumpAndSettle();
        },
      );
      expect(picked, 'kassala');
    });

    testWidgets('there is no "use my location" button', (tester) async {
      await _open(
        tester,
        afterOpen: () async {
          expect(find.byKey(const ValueKey('city-use-location')), findsNothing);
        },
      );
    });

    testWidgets('the company picker returns the chosen cities in list order',
        (tester) async {
      List<String>? result;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (context) => Scaffold(
              body: ElevatedButton(
                onPressed: () async => result = await showCityMultiPickerSheet(
                  context,
                  selectedIds: const ['bahri'],
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('city-khartoum')));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('city-multi-done')));
      await tester.pumpAndSettle();
      expect(result, ['khartoum', 'bahri']);
    });
  });
}
