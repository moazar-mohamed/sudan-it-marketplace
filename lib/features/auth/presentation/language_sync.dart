import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_locale.dart';
import '../../../core/localization/locale_controller.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../domain/entities/user_profile.dart';
import 'auth_providers.dart';
import 'auth_controller.dart';
import 'auth_state.dart';

/// Set while a language the user chose could not be saved to their profile
/// yet (offline, rules not deployed). The next sign-in then pushes the local
/// choice instead of adopting the older stored one.
const languagePendingSyncKey = 'language_pending_sync';

/// Keeps the app language and `users/{uid}.language` in step:
///
/// 1. a valid language stored on the profile wins,
/// 2. otherwise the language chosen on this device is saved to the profile,
/// 3. otherwise nothing is written (English stays the default).
///
/// Watched once from the root widget. Nothing is read from Firestore before
/// sign-in: the login screens use the device preference alone.
final languageSyncProvider = Provider<void>((ref) {
  String? syncedUserId;

  void adopt(UserProfile profile) {
    if (syncedUserId == profile.id) return;
    syncedUserId = profile.id;
    ref.read(languageServiceProvider).reconcile(profile);
  }

  ref.listen<AsyncValue<UserProfile?>>(profileControllerProvider, (_, next) {
    final profile = next.asData?.value;
    if (profile == null) {
      // Signed out (or no profile yet): the next user is synced afresh.
      if (ref.read(authControllerProvider) is! AuthAuthenticated) {
        syncedUserId = null;
      }
      return;
    }
    adopt(profile);
  }, fireImmediately: true);
});

final languageServiceProvider = Provider<LanguageService>(LanguageService.new);

class LanguageService {
  LanguageService(this._ref);

  final Ref _ref;

  /// Applies [locale] everywhere at once (the whole app re-renders and flips
  /// direction), remembers it on the device and, when signed in, saves it to
  /// the user's own profile. Returns false only when that save failed; the
  /// language is changed on this device regardless.
  Future<bool> change(Locale locale) async {
    final next = AppLocale.tryParse(locale.languageCode);
    if (next == null) return true;
    await _ref.read(localeControllerProvider.notifier).setLocale(next);
    return _saveToProfile(AppLocale.codeOf(next));
  }

  /// Applies the rules above when a profile has just been loaded.
  Future<void> reconcile(UserProfile profile) async {
    final prefs = _ref.read(sharedPreferencesProvider);
    final pending = prefs?.getBool(languagePendingSyncKey) ?? false;
    final remote = AppLocale.tryParse(profile.language);
    final controller = _ref.read(localeControllerProvider.notifier);

    if (remote != null && !pending) {
      await controller.setLocale(remote);
      return;
    }
    if (controller.hasStoredPreference) {
      await _saveToProfile(AppLocale.codeOf(_ref.read(localeControllerProvider)));
    }
  }

  Future<bool> _saveToProfile(String language) async {
    final authState = _ref.read(authControllerProvider);
    if (authState is! AuthAuthenticated) return true;
    final prefs = _ref.read(sharedPreferencesProvider);
    try {
      await _ref.read(userProfileRepositoryProvider).updateLanguage(
            userId: authState.user.id,
            language: language,
          );
      await prefs?.remove(languagePendingSyncKey);
      _ref.read(profileControllerProvider.notifier).applyLanguage(language);
      return true;
    } catch (_) {
      await prefs?.setBool(languagePendingSyncKey, true);
      return false;
    }
  }
}
