import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/data/models/user_profile_model.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/auth_user.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/auth_repository.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_providers.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/register_screen.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/site/site_terms.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

/// The terms and conditions are accepted as on sictm.net: a box on the
/// sign-up form, and before the shop for anyone who has not accepted the
/// published version.

const _terms = SiteTerms(version: 3, textAr: 'كن لطيفًا.', textEn: 'Be kind.');

/// Records what the sign-up was given; signs in as the new account.
class _FakeAuthRepository extends Fake implements AuthRepository {
  final _changes = StreamController<AuthUser?>.broadcast();
  final signUps = <int?>[];

  @override
  Stream<AuthUser?> authStateChanges() async* {
    yield null;
    yield* _changes.stream;
  }

  @override
  AuthUser? get currentUser => null;

  @override
  Future<AuthUser> signUpWithEmail({
    required String fullName,
    required String email,
    required String password,
    int? termsVersion,
  }) async {
    signUps.add(termsVersion);
    return AuthUser(id: 'u1', email: email);
  }
}

Widget _app(Widget home, List overrides) => ProviderScope(
      // ignore: argument_type_not_assignable
      overrides: overrides.cast(),
      child: MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

Future<void> _fillForm(WidgetTester tester) async {
  final fields = find.byType(TextFormField);
  await tester.enterText(fields.at(0), 'Amna Ali');
  await tester.enterText(fields.at(1), 'amna@example.test');
  await tester.enterText(fields.at(2), 'secret123');
  await tester.enterText(fields.at(3), 'secret123');
}

Future<void> _tapRegister(WidgetTester tester) async {
  final button = find.widgetWithText(FilledButton, 'Register');
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pumpAndSettle();
}

void main() {
  test('who still has to accept', () {
    expect(siteNeedsTerms(null, null), isFalse);
    expect(siteNeedsTerms(_terms, null), isTrue);
    expect(siteNeedsTerms(_terms, 2), isTrue);
    expect(siteNeedsTerms(_terms, 3), isFalse);
    expect(siteNeedsTerms(_terms, 4), isFalse);
  });

  test('the profile reads the accepted version (whole numbers only)', () {
    UserProfileModel read(Object? v) => UserProfileModel.fromFirestoreMap(
          {'fullName': 'A', 'email': 'a@b.c', 'role': 'customer', 'termsVersion': v},
          'u1',
        );
    expect(read(3).termsVersion, 3);
    expect(read('3').termsVersion, isNull);
    expect(read(null).termsVersion, isNull);
  });

  group('the sign-up form', () {
    testWidgets('with published terms: the box must be ticked, then the version goes with the account', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final repository = _FakeAuthRepository();
      await tester.pumpWidget(_app(const RegisterScreen(), [
        authRepositoryProvider.overrideWithValue(repository),
        siteTermsProvider.overrideWith((ref) => Stream.value(_terms)),
      ]));
      await tester.pumpAndSettle();
      await _fillForm(tester);

      await _tapRegister(tester);
      expect(find.byKey(const ValueKey('register-terms-error')), findsOneWidget);
      expect(repository.signUps, isEmpty);

      await tester.tap(find.byKey(const ValueKey('register-terms')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('register-terms-error')), findsNothing);
      await _tapRegister(tester);
      expect(repository.signUps, [3]);
    });

    testWidgets('without published terms: no box, nothing recorded', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final repository = _FakeAuthRepository();
      await tester.pumpWidget(_app(const RegisterScreen(), [
        authRepositoryProvider.overrideWithValue(repository),
        siteTermsProvider.overrideWith((ref) => Stream.value(null)),
      ]));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('register-terms')), findsNothing);
      await _fillForm(tester);
      await _tapRegister(tester);
      expect(repository.signUps, [null]);
    });
  });

  group('the gate before the shop', () {
    Widget gate({int? accepted, required List<(String, int)> saves, bool ok = true, VoidCallback? onAccepted}) => _app(
          SiteTermsGate(
            uid: 'u1',
            acceptedVersion: accepted,
            onAccepted: onAccepted ?? () {},
            onSignOut: () {},
            child: const Scaffold(body: Text('the shop')),
          ),
          [
            siteTermsProvider.overrideWith((ref) => Stream.value(_terms)),
            siteTermsAcceptorProvider.overrideWithValue((uid, version) async {
              saves.add((uid, version));
              return ok;
            }),
          ],
        );

    testWidgets('an older version asks; accepting saves it and opens the shop', (tester) async {
      final saves = <(String, int)>[];
      var reloads = 0;
      await tester.pumpWidget(gate(accepted: 2, saves: saves, onAccepted: () => reloads++));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('terms-gate')), findsOneWidget);
      expect(find.text('Be kind.'), findsOneWidget);
      // Nothing to press until the box is ticked.
      expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'I accept and continue')).onPressed, isNull);

      await tester.tap(find.byKey(const ValueKey('terms-gate-check')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('I accept and continue'));
      await tester.pumpAndSettle();
      expect(saves, [('u1', 3)]);
      expect(reloads, 1);
      expect(find.text('the shop'), findsOneWidget);
    });

    testWidgets('a save that fails says so and stays', (tester) async {
      final saves = <(String, int)>[];
      await tester.pumpWidget(gate(saves: saves, ok: false));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('terms-gate-check')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('I accept and continue'));
      await tester.pumpAndSettle();
      expect(find.text('Could not save your acceptance. Check your connection and try again.'), findsOneWidget);
      expect(find.text('the shop'), findsNothing);
    });

    testWidgets('the published version already accepted: straight to the shop', (tester) async {
      await tester.pumpWidget(gate(accepted: 3, saves: []));
      await tester.pumpAndSettle();
      expect(find.text('the shop'), findsOneWidget);
    });
  });
}
