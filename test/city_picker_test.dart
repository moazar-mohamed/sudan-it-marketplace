import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/cities/domain/sudan_city.dart';
import 'package:sudan_it_marketplace/features/cities/presentation/city_picker_sheets.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

/// Opens the sheet from a button and returns what it popped.
Future<String?> _open(
  WidgetTester tester, {
  Locale locale = const Locale('en'),
  Map<String, int> counts = const {},
  Future<String?> Function()? locate,
  bool allowBrowseAll = false,
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
                  locate: locate,
                  allowBrowseAll: allowBrowseAll,
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
  group('nearestCity', () {
    test('finds the city a point is in', () {
      expect(nearestCity(15.50, 32.56)?.id, 'khartoum');
      expect(nearestCity(19.62, 37.21)?.id, 'port_sudan');
      expect(nearestCity(12.05, 24.88)?.id, 'nyala');
    });

    test('returns null when no listed city is near', () {
      expect(nearestCity(30.0, 31.2), isNull); // Cairo
    });
  });

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

    testWidgets('the browse-all row only appears when allowed', (tester) async {
      await _open(
        tester,
        afterOpen: () async {
          expect(find.byKey(const ValueKey('city-browse-all')), findsNothing);
        },
      );
      await tester.pumpWidget(const SizedBox());
      await _open(
        tester,
        allowBrowseAll: true,
        afterOpen: () async {
          expect(find.byKey(const ValueKey('city-browse-all')), findsOneWidget);
        },
      );
    });

    testWidgets('the location button picks the nearest city, or says it failed',
        (tester) async {
      await _open(
        tester,
        locate: () async => null,
        afterOpen: () async {
          await tester.tap(find.byKey(const ValueKey('city-use-location')));
          await tester.pumpAndSettle();
          expect(
            find.text(
              'Could not find your location. Choose your city from the list.',
            ),
            findsOneWidget,
          );
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
