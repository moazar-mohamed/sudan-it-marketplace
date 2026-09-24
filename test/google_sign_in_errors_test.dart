import 'package:flutter_test/flutter_test.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sudan_it_marketplace/features/auth/data/datasources/firebase_auth_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_error_messages.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

GoogleSignInException _error(GoogleSignInExceptionCode code, [String? description]) =>
    GoogleSignInException(code: code, description: description);

void main() {
  group('why a Google sign-in failed', () {
    test('closing the account picker is a quiet cancel', () {
      expect(
        googleSignInFailureCode(
          _error(GoogleSignInExceptionCode.canceled, 'activity is cancelled by the user.'),
        ),
        'canceled',
      );
      expect(googleSignInFailureCode(_error(GoogleSignInExceptionCode.canceled)), 'canceled');
    });

    test('an account that must sign in again is a failure, not a cancel', () {
      expect(
        googleSignInFailureCode(
          _error(GoogleSignInExceptionCode.canceled, '[16] Account reauth failed.'),
        ),
        'google-reauth-required',
      );
    });

    test('a setup problem is reported as one', () {
      expect(
        googleSignInFailureCode(_error(GoogleSignInExceptionCode.clientConfigurationError)),
        'google-config-error',
      );
      expect(
        googleSignInFailureCode(_error(GoogleSignInExceptionCode.providerConfigurationError)),
        'google-config-error',
      );
    });

    test('anything else is a general Google failure', () {
      for (final code in [
        GoogleSignInExceptionCode.unknownError,
        GoogleSignInExceptionCode.interrupted,
        GoogleSignInExceptionCode.uiUnavailable,
      ]) {
        expect(googleSignInFailureCode(_error(code)), 'google-sign-in-failed');
      }
    });
  });

  group('what the user is told', () {
    final en = AppLocalizationsEn();
    final ar = AppLocalizationsAr();

    test('each failure has its own message in both languages', () {
      expect(authErrorMessage(en, 'google-reauth-required'), en.authErrorGoogleReauth);
      expect(authErrorMessage(en, 'google-config-error'), en.authErrorGoogleConfig);
      expect(authErrorMessage(ar, 'google-reauth-required'), ar.authErrorGoogleReauth);
      expect(authErrorMessage(ar, 'google-config-error'), ar.authErrorGoogleConfig);
      expect(authErrorMessage(en, 'google-reauth-required'), contains('sign in'));
      // Not the vague general message.
      expect(authErrorMessage(en, 'google-reauth-required'), isNot(en.authErrorGeneric));
      expect(authErrorMessage(en, 'google-config-error'), isNot(en.authErrorGeneric));
    });
  });
}
