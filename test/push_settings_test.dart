import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sudan_it_marketplace/core/localization/locale_controller.dart';
import 'package:sudan_it_marketplace/core/push/push_relay.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/features/push/data/push_tokens.dart';
import 'package:sudan_it_marketplace/features/push/presentation/push_preference.dart';
import 'package:sudan_it_marketplace/features/settings/presentation/settings_screen.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

class _Relay implements PushRelay {
  const _Relay({required this.isEnabled});

  @override
  final bool isEnabled;

  @override
  Future<void> notification(String notificationId) async {}

  @override
  Future<void> chatMessage({
    required String chatId,
    required String messageId,
  }) async {}
}

Future<SharedPreferences> _prefs([Map<String, Object> values = const {}]) {
  SharedPreferences.setMockInitialValues(values);
  return SharedPreferences.getInstance();
}

Widget _app(
  SharedPreferences prefs, {
  bool relay = true,
  String language = 'en',
  bool blocked = false,
}) => ProviderScope(
  overrides: [
    sharedPreferencesProvider.overrideWithValue(prefs),
    pushRelayProvider.overrideWithValue(_Relay(isEnabled: relay)),
    if (blocked) pushBlockedProvider.overrideWith(() => _Blocked()),
  ],
  child: MaterialApp(
    theme: AppTheme.light,
    locale: Locale(language),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: const SettingsScreen(),
  ),
);

class _Blocked extends PushBlockedController {
  @override
  bool build() => true;
}

final _row = find.byKey(const ValueKey('settings-push'));
Switch _switch(WidgetTester tester) =>
    tester.widget<Switch>(find.byType(Switch));

void main() {
  group('the phone notifications preference', () {
    test('is on until the user turns it off', () async {
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(await _prefs()),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(pushEnabledProvider), isTrue);
    });

    test('starts from the stored choice', () async {
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(
            await _prefs({pushEnabledPreferenceKey: false}),
          ),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(pushEnabledProvider), isFalse);
    });

    test('a choice is remembered on this phone', () async {
      final prefs = await _prefs();
      final container = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);
      await container.read(pushEnabledProvider.notifier).setEnabled(false);
      expect(container.read(pushEnabledProvider), isFalse);
      expect(prefs.getBool(pushEnabledPreferenceKey), isFalse);
      await container.read(pushEnabledProvider.notifier).setEnabled(true);
      expect(prefs.getBool(pushEnabledPreferenceKey), isTrue);
    });

    test('still works when the device storage is unavailable', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(container.read(pushEnabledProvider), isTrue);
      await container.read(pushEnabledProvider.notifier).setEnabled(false);
      expect(container.read(pushEnabledProvider), isFalse);
    });
  });

  group('a phone taken off a user', () {
    test('only that phone is removed', () {
      expect(withoutPushToken(['a', 'b', 'c'], 'b'), ['a', 'c']);
    });

    test('an unknown phone changes nothing', () {
      expect(withoutPushToken(['a', 'b'], 'z'), ['a', 'b']);
      expect(withoutPushToken(const [], 'z'), isEmpty);
    });
  });

  group('the switch in Settings', () {
    testWidgets('is on by default, and turning it off is remembered', (
      tester,
    ) async {
      final prefs = await _prefs();
      await tester.pumpWidget(_app(prefs));
      await tester.pumpAndSettle();

      expect(find.text('Phone notifications'), findsOneWidget);
      expect(find.text('On for this phone'), findsOneWidget);
      expect(_switch(tester).value, isTrue);

      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();

      expect(_switch(tester).value, isFalse);
      expect(find.text('Off for this phone'), findsOneWidget);
      expect(prefs.getBool(pushEnabledPreferenceKey), isFalse);
    });

    testWidgets('the whole row is the target, and it turns back on', (
      tester,
    ) async {
      final prefs = await _prefs({pushEnabledPreferenceKey: false});
      await tester.pumpWidget(_app(prefs));
      await tester.pumpAndSettle();
      expect(_switch(tester).value, isFalse);

      await tester.tap(_row);
      await tester.pumpAndSettle();

      expect(_switch(tester).value, isTrue);
      expect(prefs.getBool(pushEnabledPreferenceKey), isTrue);
    });

    testWidgets('says when the phone itself blocks the notifications', (
      tester,
    ) async {
      await tester.pumpWidget(_app(await _prefs(), blocked: true));
      await tester.pumpAndSettle();
      expect(find.textContaining('Blocked in your phone'), findsOneWidget);
      expect(find.text('On for this phone'), findsNothing);
    });

    testWidgets('a blocked phone with the switch off just says it is off', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(await _prefs({pushEnabledPreferenceKey: false}), blocked: true),
      );
      await tester.pumpAndSettle();
      expect(find.text('Off for this phone'), findsOneWidget);
      expect(find.textContaining('Blocked'), findsNothing);
    });

    testWidgets('is not there when pushes cannot be sent at all', (
      tester,
    ) async {
      await tester.pumpWidget(_app(await _prefs(), relay: false));
      await tester.pumpAndSettle();
      expect(find.byType(Switch), findsNothing);
      expect(find.text('Phone notifications'), findsNothing);
      // The other settings are untouched.
      expect(find.byKey(const ValueKey('settings-language')), findsOneWidget);
    });

    testWidgets('reads in Arabic', (tester) async {
      await tester.pumpWidget(_app(await _prefs(), language: 'ar'));
      await tester.pumpAndSettle();
      expect(find.text('إشعارات الهاتف'), findsOneWidget);
      expect(find.text('مفعّلة على هذا الهاتف'), findsOneWidget);
    });
  });
}
