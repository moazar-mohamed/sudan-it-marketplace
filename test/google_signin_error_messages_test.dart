import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_error_messages.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

/// Web Google sign-in uses signInWithPopup: the browser can block the popup,
/// or the hosting domain may not be authorized. Both must produce a specific,
/// localized message rather than the generic sign-in failure.
void main() {
  Future<AppLocalizations> l10nFor(Locale locale) =>
      AppLocalizations.delegate.load(locale);

  test('a blocked popup gets its own English and Arabic message', () async {
    final en = await l10nFor(const Locale('en'));
    final ar = await l10nFor(const Locale('ar'));

    expect(authErrorMessage(en, 'popup-blocked'), en.authErrorPopupBlocked);
    expect(authErrorMessage(ar, 'popup-blocked'), ar.authErrorPopupBlocked);
    expect(authErrorMessage(en, 'popup-blocked'),
        isNot(en.authErrorGoogleFailed));
  });

  test('an unauthorized domain gets its own English and Arabic message',
      () async {
    final en = await l10nFor(const Locale('en'));
    final ar = await l10nFor(const Locale('ar'));

    expect(authErrorMessage(en, 'unauthorized-domain'),
        en.authErrorUnauthorizedDomain);
    expect(authErrorMessage(ar, 'unauthorized-domain'),
        ar.authErrorUnauthorizedDomain);
  });

  test('an unrecognized Google failure still falls back to the generic message',
      () async {
    final en = await l10nFor(const Locale('en'));
    expect(authErrorMessage(en, 'google-sign-in-failed'),
        en.authErrorGoogleFailed);
  });
}
