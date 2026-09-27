import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sudan_it_marketplace/core/localization/locale_controller.dart';
import 'package:sudan_it_marketplace/core/theme/app_colors.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/core/theme/theme_controller.dart';
import 'package:sudan_it_marketplace/features/settings/presentation/settings_screen.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

Future<SharedPreferences> _prefs([Map<String, Object> values = const {}]) {
  SharedPreferences.setMockInitialValues(values);
  return SharedPreferences.getInstance();
}

/// Wired like the real root MaterialApp: both themes, mode from the provider.
class _App extends ConsumerWidget {
  const _App();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ref.watch(themeModeControllerProvider),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const SettingsScreen(),
    );
  }
}

Widget _app(SharedPreferences prefs) => ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      child: const _App(),
    );

Future<void> _chooseAppearance(WidgetTester tester, String label) async {
  await tester.tap(find.byKey(const ValueKey('settings-appearance')));
  await tester.pumpAndSettle();
  await tester.tap(
    find.descendant(of: find.byType(BottomSheet), matching: find.text(label)),
  );
  await tester.pumpAndSettle();
}

AppColorTokens _screenColors(WidgetTester tester) =>
    tester.element(find.byType(SettingsScreen)).colors;

void main() {
  group('the appearance preference on the device', () {
    test('follows the phone when nothing was chosen', () async {
      final container = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(await _prefs())],
      );
      addTearDown(container.dispose);
      expect(container.read(themeModeControllerProvider), ThemeMode.system);
    });

    test('starts from the stored choice and ignores an unknown value', () async {
      final dark = ProviderContainer(
        overrides: [
          sharedPreferencesProvider
              .overrideWithValue(await _prefs({'theme_mode': 'dark'})),
        ],
      );
      addTearDown(dark.dispose);
      expect(dark.read(themeModeControllerProvider), ThemeMode.dark);

      final junk = ProviderContainer(
        overrides: [
          sharedPreferencesProvider
              .overrideWithValue(await _prefs({'theme_mode': 'sepia'})),
        ],
      );
      addTearDown(junk.dispose);
      expect(junk.read(themeModeControllerProvider), ThemeMode.system);
    });

    test('works without storage', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      await container
          .read(themeModeControllerProvider.notifier)
          .setMode(ThemeMode.dark);
      expect(container.read(themeModeControllerProvider), ThemeMode.dark);
    });
  });

  group('Settings > Appearance', () {
    testWidgets('shows both preferences with their current values',
        (tester) async {
      await tester.pumpWidget(_app(await _prefs()));
      await tester.pumpAndSettle();

      expect(find.text('Language'), findsOneWidget);
      expect(find.text('English'), findsOneWidget);
      expect(find.text('Appearance'), findsOneWidget);
      expect(find.text('System default'), findsOneWidget);
    });

    testWidgets('the sheet offers system, light and dark, current one ticked',
        (tester) async {
      await tester.pumpWidget(_app(await _prefs({'theme_mode': 'light'})));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('settings-appearance')));
      await tester.pumpAndSettle();

      final sheet = find.byType(BottomSheet);
      for (final label in ['System default', 'Light', 'Dark']) {
        expect(
          find.descendant(of: sheet, matching: find.text(label)),
          findsOneWidget,
        );
      }
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('settings-option-ThemeMode.light')),
          matching: find.byIcon(Icons.check_circle_rounded),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(of: sheet, matching: find.byIcon(Icons.check_circle_rounded)),
        findsOneWidget,
      );
    });

    testWidgets('choosing Dark repaints the open screen at once and is remembered',
        (tester) async {
      final prefs = await _prefs();
      await tester.pumpWidget(_app(prefs));
      await tester.pumpAndSettle();
      expect(_screenColors(tester), AppColorTokens.light);

      await _chooseAppearance(tester, 'Dark');

      expect(find.byType(BottomSheet), findsNothing);
      expect(find.byType(SettingsScreen), findsOneWidget, reason: 'no restart');
      expect(_screenColors(tester), AppColorTokens.dark);
      expect(
        Theme.of(tester.element(find.byType(SettingsScreen))).brightness,
        Brightness.dark,
      );
      expect(find.text('Dark'), findsOneWidget);
      expect(prefs.getString('theme_mode'), 'dark');

      await _chooseAppearance(tester, 'Light');
      expect(_screenColors(tester), AppColorTokens.light);
      expect(prefs.getString('theme_mode'), 'light');
    });

    testWidgets('System default follows the phone', (tester) async {
      tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);

      await tester.pumpWidget(_app(await _prefs()));
      await tester.pumpAndSettle();
      expect(_screenColors(tester), AppColorTokens.dark);

      tester.platformDispatcher.platformBrightnessTestValue = Brightness.light;
      await tester.pumpAndSettle();
      expect(_screenColors(tester), AppColorTokens.light);
    });

    testWidgets('the dark app bar is a raised surface, not the brand blue',
        (tester) async {
      await tester.pumpWidget(_app(await _prefs({'theme_mode': 'dark'})));
      await tester.pumpAndSettle();

      final material = tester.widget<Material>(
        find.descendant(of: find.byType(AppBar), matching: find.byType(Material)).first,
      );
      expect(material.color, AppColorTokens.dark.bgSurface);
    });
  });
}
