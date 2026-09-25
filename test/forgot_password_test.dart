import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/auth/data/datasources/firebase_auth_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:sudan_it_marketplace/features/auth/domain/exceptions/auth_exception.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/auth_repository.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/user_profile_repository.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_controller.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_providers.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_state.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/forgot_password_screen.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/login_screen.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

final _en = AppLocalizationsEn();
final _ar = AppLocalizationsAr();

/// Records every reset request; can be told to fail or to wait.
class _FakeAuth extends Fake implements AuthRepository {
  final requests = <({String email, String? languageCode})>[];
  AuthException? failure;
  Completer<void>? gate;

  @override
  Future<void> sendPasswordResetEmail({
    required String email,
    String? languageCode,
  }) async {
    requests.add((email: email, languageCode: languageCode));
    if (gate != null) await gate!.future;
    if (failure != null) throw failure!;
  }
}

class _StubAuthController extends AuthController {
  @override
  AuthState build() => const AuthUnauthenticated();
}

Widget _app(
  Widget home,
  _FakeAuth auth, {
  Locale locale = const Locale('en'),
}) =>
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        authControllerProvider.overrideWith(_StubAuthController.new),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

Finder get _emailField => find.byType(TextFormField);

Future<void> _submit(WidgetTester tester, String email) async {
  await tester.enterText(_emailField, email);
  await tester.tap(find.text(_en.authForgotPasswordSend));
  await tester.pump();
}

// ---- data layer ------------------------------------------------------------

class _FakeFirebaseAuth extends Fake implements FirebaseAuth {
  final calls = <String>[];
  FirebaseAuthException? error;

  @override
  Future<void> setLanguageCode(String? languageCode) async =>
      calls.add('lang:$languageCode');

  @override
  Future<void> sendPasswordResetEmail({
    required String email,
    ActionCodeSettings? actionCodeSettings,
  }) async {
    calls.add('reset:$email');
    if (error != null) throw error!;
  }
}

class _RecordingRemote implements AuthRemoteDataSource {
  final calls = <({String email, String? languageCode})>[];
  AuthException? error;

  @override
  Future<void> sendPasswordResetEmail({
    required String email,
    String? languageCode,
  }) async {
    calls.add((email: email, languageCode: languageCode));
    if (error != null) throw error!;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _NoProfiles extends Fake implements UserProfileRepository {}

void main() {
  group('data layer', () {
    test('Firebase is asked for the trimmed address, in the chosen language',
        () async {
      final firebase = _FakeFirebaseAuth();
      final source = FirebaseAuthRemoteDataSource(firebaseAuth: firebase);
      await source.sendPasswordResetEmail(
        email: '  user@example.test ',
        languageCode: 'ar',
      );
      expect(firebase.calls, ['lang:ar', 'reset:user@example.test']);
    });

    test('a Firebase failure surfaces as an AuthException carrying its code',
        () async {
      final firebase = _FakeFirebaseAuth()
        ..error = FirebaseAuthException(code: 'too-many-requests');
      final source = FirebaseAuthRemoteDataSource(firebaseAuth: firebase);
      await expectLater(
        source.sendPasswordResetEmail(email: 'a@b.co'),
        throwsA(
          isA<AuthException>().having((e) => e.code, 'code', 'too-many-requests'),
        ),
      );
    });

    test('the repository trims the address and forwards the language', () async {
      final remote = _RecordingRemote();
      final repository = AuthRepositoryImpl(remote, _NoProfiles());
      await repository.sendPasswordResetEmail(
        email: ' a@b.co ',
        languageCode: 'en',
      );
      expect(remote.calls, [(email: 'a@b.co', languageCode: 'en')]);
    });

    test('the repository keeps the error code of a failed request', () async {
      final remote = _RecordingRemote()
        ..error = const AuthException('x', code: 'network-request-failed');
      final repository = AuthRepositoryImpl(remote, _NoProfiles());
      await expectLater(
        repository.sendPasswordResetEmail(email: 'a@b.co'),
        throwsA(
          isA<AuthException>()
              .having((e) => e.code, 'code', 'network-request-failed'),
        ),
      );
    });
  });

  group('the forgot-password screen', () {
    testWidgets('is pre-filled with the address typed on the login form',
        (tester) async {
      await tester.pumpWidget(
        _app(const ForgotPasswordScreen(initialEmail: 'me@example.test'), _FakeAuth()),
      );
      expect(find.text('me@example.test'), findsOneWidget);
    });

    testWidgets('an empty or malformed address is refused before any request',
        (tester) async {
      final auth = _FakeAuth();
      await tester.pumpWidget(_app(const ForgotPasswordScreen(), auth));

      await _submit(tester, '   ');
      expect(find.text(_en.authEmailRequired), findsOneWidget);

      await _submit(tester, 'not-an-email');
      expect(find.text(_en.authEmailInvalid), findsOneWidget);
      expect(auth.requests, isEmpty);
    });

    testWidgets('sends once with the trimmed address and the app language',
        (tester) async {
      final auth = _FakeAuth();
      await tester.pumpWidget(_app(const ForgotPasswordScreen(), auth));
      await _submit(tester, '  user@example.test ');
      await tester.pump();

      expect(auth.requests, [(email: 'user@example.test', languageCode: 'en')]);
      expect(find.text(_en.authForgotPasswordSentTitle), findsOneWidget);
      expect(
        find.text(_en.authForgotPasswordSentBody('user@example.test')),
        findsOneWidget,
      );
      expect(_emailField, findsNothing); // the form is replaced by the result
    });

    testWidgets('an address with no account looks exactly like a success',
        (tester) async {
      final auth = _FakeAuth()
        ..failure = const AuthException('x', code: 'user-not-found');
      await tester.pumpWidget(_app(const ForgotPasswordScreen(), auth));
      await _submit(tester, 'nobody@example.test');
      await tester.pump();

      expect(find.text(_en.authForgotPasswordSentTitle), findsOneWidget);
      expect(find.text(_en.authErrorInvalidCredentials), findsNothing);
      expect(find.text(_en.authForgotPasswordFailed), findsNothing);
    });

    for (final (code, message) in [
      ('too-many-requests', _en.authErrorTooManyRequests),
      ('network-request-failed', _en.authErrorNetwork),
      ('invalid-email', _en.authEmailInvalid),
      ('something-unexpected', _en.authForgotPasswordFailed),
    ]) {
      testWidgets('a "$code" failure shows its message and keeps the form',
          (tester) async {
        final auth = _FakeAuth()..failure = AuthException('x', code: code);
        await tester.pumpWidget(_app(const ForgotPasswordScreen(), auth));
        await _submit(tester, 'user@example.test');
        await tester.pump();

        expect(find.text(message), findsOneWidget);
        expect(find.text(_en.authForgotPasswordSentTitle), findsNothing);
        expect(_emailField, findsOneWidget);
        expect(find.text('user@example.test'), findsOneWidget); // not lost
      });
    }

    testWidgets('a second tap while sending does not send twice',
        (tester) async {
      final auth = _FakeAuth()..gate = Completer<void>();
      await tester.pumpWidget(_app(const ForgotPasswordScreen(), auth));
      await _submit(tester, 'user@example.test');
      await tester.tap(find.byType(FilledButton), warnIfMissed: false);
      await tester.pump();
      expect(auth.requests, hasLength(1));

      auth.gate!.complete();
      await tester.pump();
      expect(find.text(_en.authForgotPasswordSentTitle), findsOneWidget);
    });

    testWidgets('Resend is locked for a cooldown, then sends to the same address',
        (tester) async {
      final auth = _FakeAuth();
      await tester.pumpWidget(_app(const ForgotPasswordScreen(), auth));
      await _submit(tester, 'user@example.test');
      await tester.pump();

      expect(find.text(_en.authForgotPasswordResendIn(60)), findsOneWidget);
      await tester.tap(find.text(_en.authForgotPasswordResendIn(60)), warnIfMissed: false);
      await tester.pump();
      expect(auth.requests, hasLength(1)); // locked

      await tester.pump(const Duration(seconds: 30));
      expect(find.text(_en.authForgotPasswordResendIn(30)), findsOneWidget);

      await tester.pump(const Duration(seconds: 30));
      expect(find.text(_en.authForgotPasswordResend), findsOneWidget);
      await tester.tap(find.text(_en.authForgotPasswordResend));
      await tester.pump();

      expect(auth.requests, hasLength(2));
      expect(auth.requests.last.email, 'user@example.test');
      // and it is locked again
      expect(find.text(_en.authForgotPasswordResendIn(60)), findsOneWidget);
    });

    testWidgets('a failed resend shows the error and stays on the result',
        (tester) async {
      final auth = _FakeAuth();
      await tester.pumpWidget(
        _app(const ForgotPasswordScreen(resendCooldown: Duration.zero), auth),
      );
      await _submit(tester, 'user@example.test');
      await tester.pump();
      auth.failure = const AuthException('x', code: 'too-many-requests');
      await tester.tap(find.text(_en.authForgotPasswordResend));
      await tester.pump();
      expect(find.text(_en.authErrorTooManyRequests), findsOneWidget);
      expect(find.text(_en.authForgotPasswordSentTitle), findsOneWidget);
    });

    testWidgets('"Back to sign in" leaves the screen', (tester) async {
      final auth = _FakeAuth();
      await tester.pumpWidget(_app(const Scaffold(body: Text('login-underneath')), auth));
      final navigator = tester.state<NavigatorState>(find.byType(Navigator));
      navigator.push(
        MaterialPageRoute<void>(builder: (_) => const ForgotPasswordScreen()),
      );
      await tester.pumpAndSettle();
      await _submit(tester, 'user@example.test');
      await tester.pump();

      await tester.tap(find.text(_en.authForgotPasswordBackToLogin));
      await tester.pumpAndSettle();
      expect(find.byType(ForgotPasswordScreen), findsNothing);
      expect(find.text('login-underneath'), findsOneWidget);
    });

    testWidgets('works in Arabic: right-to-left, Arabic text, "ar" email language',
        (tester) async {
      final auth = _FakeAuth();
      await tester.pumpWidget(
        _app(const ForgotPasswordScreen(), auth, locale: const Locale('ar')),
      );
      expect(find.text(_ar.authForgotPasswordTitle), findsWidgets);
      expect(find.text(_ar.authForgotPasswordBody), findsOneWidget);
      expect(
        Directionality.of(tester.element(find.byType(Scaffold))),
        TextDirection.rtl,
      );

      await tester.enterText(_emailField, 'user@example.test');
      await tester.tap(find.text(_ar.authForgotPasswordSend));
      await tester.pump();

      expect(auth.requests.single.languageCode, 'ar');
      expect(find.text(_ar.authForgotPasswordSentTitle), findsOneWidget);
      // the address stays isolated left-to-right inside the Arabic sentence
      final body = _ar.authForgotPasswordSentBody('user@example.test');
      expect(body, contains('‎user@example.test‎'));
      expect(find.text(body), findsOneWidget);
      expect(find.text(_ar.authForgotPasswordResendIn(60)), findsOneWidget);
    });
  });

  group('from the login screen', () {
    testWidgets(
        'the link opens the reset screen with the typed address, and no "soon"',
        (tester) async {
      final auth = _FakeAuth();
      await tester.pumpWidget(_app(const LoginScreen(), auth));

      await tester.enterText(find.byType(TextFormField).first, 'me@example.test');
      await tester.tap(find.text(_en.authForgotPassword));
      await tester.pumpAndSettle();

      expect(find.byType(ForgotPasswordScreen), findsOneWidget);
      expect(find.text('me@example.test'), findsOneWidget);
      expect(find.textContaining('soon'), findsNothing);
    });

    testWidgets('requesting a reset never changes the app-wide sign-in state',
        (tester) async {
      final auth = _FakeAuth()
        ..failure = const AuthException('x', code: 'too-many-requests');
      await tester.pumpWidget(_app(const LoginScreen(), auth));
      final container = ProviderScope.containerOf(
        tester.element(find.byType(LoginScreen)),
      );

      await tester.tap(find.text(_en.authForgotPassword));
      await tester.pumpAndSettle();
      await _submit(tester, 'me@example.test');
      await tester.pump();

      // A failed request must not become a login error that would replace the
      // whole screen (AuthGate reacts to AuthLoading / AuthError).
      expect(container.read(authControllerProvider), isA<AuthUnauthenticated>());
      expect(find.byType(ForgotPasswordScreen), findsOneWidget);
      expect(find.text(_en.authErrorTooManyRequests), findsOneWidget);
    });
  });
}
