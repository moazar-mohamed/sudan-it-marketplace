import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../l10n/app_localizations.dart';
import 'app_locale.dart';

/// Where the chosen language is remembered on this device.
const languagePreferenceKey = 'language';

/// The device's SharedPreferences, provided once at startup. It is null in
/// tests (and if the platform storage is unavailable), in which case the
/// language simply is not persisted locally.
final sharedPreferencesProvider = Provider<SharedPreferences?>((ref) => null);

/// The language the whole app is showing. Watched by the root MaterialApp, so
/// changing it re-renders every screen with the new texts and direction, with
/// no restart.
final localeControllerProvider = NotifierProvider<LocaleController, Locale>(
  LocaleController.new,
);

/// The translations for the current language, for code that has no
/// BuildContext (controllers building a user-facing message).
final appLocalizationsProvider = Provider<AppLocalizations>((ref) {
  return lookupAppLocalizations(ref.watch(localeControllerProvider));
});

class LocaleController extends Notifier<Locale> {
  SharedPreferences? get _prefs => ref.read(sharedPreferencesProvider);

  @override
  Locale build() {
    // Start from the language stored on this device, so the very first frame
    // (login screen included) is already correct. English when nothing is set.
    return AppLocale.tryParse(_prefs?.getString(languagePreferenceKey)) ??
        AppLocale.fallback;
  }

  /// Switches the app language now and remembers it on this device. Syncing
  /// it to the signed-in user's profile is the auth feature's job.
  Future<void> setLocale(Locale locale) async {
    final next = AppLocale.tryParse(locale.languageCode);
    if (next == null) return;
    if (state != next) state = next;
    await _prefs?.setString(languagePreferenceKey, AppLocale.codeOf(next));
  }

  /// Whether a language was ever stored on this device.
  bool get hasStoredPreference =>
      AppLocale.tryParse(_prefs?.getString(languagePreferenceKey)) != null;
}
