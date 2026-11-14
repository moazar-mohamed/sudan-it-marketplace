import 'dart:ui';

/// The languages the app is translated into, and how a stored language code
/// (local preference or `users/{uid}.language`) is turned into a [Locale].
class AppLocale {
  const AppLocale._();

  static const english = Locale('en');
  static const arabic = Locale('ar');

  /// Used when nothing has been chosen yet.
  static const fallback = english;

  static const supported = [english, arabic];

  /// The [Locale] for a stored language code, or null when the value is
  /// missing or not one of the supported languages. Anything else stored in a
  /// profile is ignored rather than trusted.
  static Locale? tryParse(Object? code) {
    return switch (code) {
      'en' => english,
      'ar' => arabic,
      _ => null,
    };
  }

  /// The code that is stored locally and in `users/{uid}.language`.
  static String codeOf(Locale locale) => locale.languageCode;

  static bool isRtl(Locale locale) => locale.languageCode == 'ar';
}
