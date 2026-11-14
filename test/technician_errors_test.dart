import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/errors/app_exception.dart';
import 'package:sudan_it_marketplace/core/localization/error_messages.dart';
import 'package:sudan_it_marketplace/features/technicians/data/datasources/firestore_technicians_remote_data_source.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

AppException _fromAuth(String code) =>
    technicianAccountFailure(FirebaseAuthException(code: code, message: 'raw'));

void main() {
  final en = AppLocalizationsEn();
  final ar = AppLocalizationsAr();

  group('creating a technician login', () {
    test('each known Firebase Auth failure has its own error', () {
      expect(_fromAuth('email-already-in-use').code,
          AppErrorCode.technicianEmailInUse);
      expect(_fromAuth('invalid-email').code,
          AppErrorCode.technicianEmailInvalid);
      expect(_fromAuth('weak-password').code,
          AppErrorCode.technicianPasswordWeak);
      expect(_fromAuth('too-many-requests').code,
          AppErrorCode.technicianTooManyRequests);
      expect(_fromAuth('operation-not-allowed').code,
          AppErrorCode.technicianAuthDisabled);
      expect(_fromAuth('network-request-failed').code,
          AppErrorCode.technicianNetwork);
    });

    test('an unknown failure keeps its code so the message can show it', () {
      final error = _fromAuth('quota-exceeded');
      expect(error.code, AppErrorCode.technicianSaveFailed);
      expect(error.reason, 'quota-exceeded');
    });

    test('the messages say what is wrong, in English', () {
      String message(String code) =>
          localizedErrorMessage(en, _fromAuth(code));
      expect(message('email-already-in-use'),
          'An account with this email already exists.');
      expect(message('invalid-email'), 'This email address is not valid.');
      expect(message('weak-password'), contains('too weak'));
      expect(message('too-many-requests'), contains('Too many attempts'));
      expect(message('operation-not-allowed'), contains('turned off'));
      expect(message('network-request-failed'), en.errorNetwork);
      expect(message('quota-exceeded'),
          '${en.technicianSaveFailed} (quota-exceeded)');
    });

    test('and in Arabic', () {
      String message(String code) =>
          localizedErrorMessage(ar, _fromAuth(code));
      expect(message('invalid-email'), ar.technicianEmailInvalid);
      expect(message('weak-password'), ar.technicianPasswordWeak);
      expect(message('network-request-failed'), ar.errorNetwork);
      expect(message('quota-exceeded'),
          '${ar.technicianSaveFailed} (quota-exceeded)');
      // Every specific message is different from the general one.
      for (final code in [
        'invalid-email',
        'weak-password',
        'too-many-requests',
        'operation-not-allowed',
      ]) {
        expect(message(code), isNot(ar.technicianSaveFailed));
      }
    });
  });

  group('messages without a reason stay unchanged', () {
    test('the general failure message has no empty brackets', () {
      expect(
        localizedErrorMessage(
            en, const AppException(AppErrorCode.technicianSaveFailed)),
        en.technicianSaveFailed,
      );
    });

    test('a Firestore error is still translated by the shared resolver', () {
      expect(
        localizedErrorMessage(
            en, FirebaseException(plugin: 'cloud_firestore', code: 'unavailable')),
        en.errorNetwork,
      );
    });
  });
}
