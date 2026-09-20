import 'package:flutter/material.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/data/models/user_profile_model.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/auth_user.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_controller.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_gate.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_state.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/force_password_change_screen.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/company_admin_shell.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';

UserProfile _profile({
  UserRole role = UserRole.companyAdmin,
  bool mustChangePassword = true,
}) =>
    UserProfile(
      id: 'u1',
      fullName: 'ABC Technology',
      email: 'abc@gmail.com',
      role: role,
      createdAt: DateTime(2026),
      isActive: true,
      companyId: 'AbC123xYz',
      mustChangePassword: mustChangePassword,
    );

class _FakeAuth extends AuthController {
  int signOuts = 0;

  @override
  AuthState build() =>
      const AuthAuthenticated(AuthUser(id: 'u1', email: 'abc@gmail.com'));

  @override
  Future<void> signOut() async => signOuts++;
}

/// Stands in for the Firebase-backed controller and records what the screen
/// asks it to do, in order.
class _FakeProfile extends ProfileController {
  _FakeProfile(this._initial, {this.changeError, this.markErrors = 0});

  final UserProfile _initial;
  final String? changeError;
  int markErrors;
  final calls = <String>[];

  @override
  Future<UserProfile?> build() async => _initial;

  @override
  Future<String?> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    calls.add('change($currentPassword->$newPassword)');
    return changeError;
  }

  @override
  Future<String?> markPasswordChanged() async {
    calls.add('mark');
    if (markErrors > 0) {
      markErrors--;
      return 'Could not finish setting up your account. Please try again.';
    }
    state = AsyncData(state.requireValue!.copyWith(mustChangePassword: false));
    return null;
  }
}

Widget _app(Widget home, _FakeProfile profile, _FakeAuth auth,
    {Locale locale = const Locale('en')}) {
  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(() => auth),
      profileControllerProvider.overrideWith(() => profile),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: home,
    ),
  );
}

Future<void> _enter(WidgetTester tester,
    {String current = 'Temp@2026', String next = 'MyOwn@2026', String? confirm}) async {
  await tester.enterText(find.widgetWithText(TextFormField, 'Temporary password'), current);
  await tester.enterText(find.widgetWithText(TextFormField, 'New password'), next);
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Confirm new password'),
    confirm ?? next,
  );
}

Future<void> _submit(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(FilledButton, 'Change password'));
  await tester.pumpAndSettle();
}

void main() {
  group('mustChangePassword on the profile', () {
    UserProfile parse(Map<String, dynamic> extra) =>
        UserProfileModel.fromFirestoreMap({
          'role': 'company_admin',
          'companyId': 'AbC123xYz',
          'email': 'abc@gmail.com',
          ...extra,
        }, 'u1');

    test('is read from the stored profile', () {
      expect(parse({'mustChangePassword': true}).mustChangePassword, isTrue);
      expect(parse({'mustChangePassword': false}).mustChangePassword, isFalse);
    });

    test('an account without the flag is not asked to change anything', () {
      final legacy = parse({});
      expect(legacy.mustChangePassword, isFalse);
      expect(legacy.requiresPasswordChange, isFalse);
    });

    test('only a real true counts', () {
      expect(parse({'mustChangePassword': 'true'}).mustChangePassword, isFalse);
      expect(parse({'mustChangePassword': 1}).mustChangePassword, isFalse);
    });

    test('a company admin with the flag must change the password first', () {
      expect(_profile().requiresPasswordChange, isTrue);
      expect(_profile(mustChangePassword: false).requiresPasswordChange, isFalse);
    });

    test('the flag only gates company admins', () {
      expect(_profile(role: UserRole.customer).requiresPasswordChange, isFalse);
      expect(_profile(role: UserRole.technician).requiresPasswordChange, isFalse);
    });

    test('a customer profile is never written with the flag', () {
      final map = UserProfileModel.customer(
        id: 'c1',
        fullName: 'C',
        email: 'c@x.test',
      ).toFirestoreMap();
      expect(map.containsKey('mustChangePassword'), isFalse);
    });
  });

  group('first login', () {
    testWidgets('a company admin on a temporary password is sent to the change screen',
        (tester) async {
      await tester.pumpWidget(
        _app(const AuthGate(), _FakeProfile(_profile()), _FakeAuth()),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ForcePasswordChangeScreen), findsOneWidget);
      expect(find.byType(CompanyAdminShell), findsNothing);
      expect(find.text('Choose a new password'), findsWidgets);
    });

    testWidgets('changing the password calls Firebase first, then clears the flag',
        (tester) async {
      final profile = _FakeProfile(_profile());
      await tester.pumpWidget(
        _app(const ForcePasswordChangeScreen(), profile, _FakeAuth()),
      );
      await tester.pumpAndSettle();

      await _enter(tester);
      await _submit(tester);

      expect(profile.calls, ['change(Temp@2026->MyOwn@2026)', 'mark']);
      expect(profile.state.requireValue!.mustChangePassword, isFalse);
      expect(profile.state.requireValue!.requiresPasswordChange, isFalse);
    });

    testWidgets('a wrong temporary password keeps the gate closed', (tester) async {
      final profile = _FakeProfile(
        _profile(),
        changeError: 'Current password is incorrect.',
      );
      await tester.pumpWidget(
        _app(const ForcePasswordChangeScreen(), profile, _FakeAuth()),
      );
      await tester.pumpAndSettle();

      await _enter(tester);
      await _submit(tester);

      expect(find.text('Current password is incorrect.'), findsOneWidget);
      expect(profile.calls, ['change(Temp@2026->MyOwn@2026)']); // flag never touched
      expect(profile.state.requireValue!.requiresPasswordChange, isTrue);
    });

    testWidgets('if clearing the flag fails, retry only redoes the flag',
        (tester) async {
      final profile = _FakeProfile(_profile(), markErrors: 1);
      await tester.pumpWidget(
        _app(const ForcePasswordChangeScreen(), profile, _FakeAuth()),
      );
      await tester.pumpAndSettle();

      await _enter(tester);
      await _submit(tester);
      expect(find.textContaining('Could not finish setting up'), findsOneWidget);
      expect(profile.state.requireValue!.requiresPasswordChange, isTrue);

      // The temporary password no longer works, so it must not be sent again.
      await _submit(tester);
      expect(profile.calls, ['change(Temp@2026->MyOwn@2026)', 'mark', 'mark']);
      expect(profile.state.requireValue!.requiresPasswordChange, isFalse);
    });

    testWidgets('a new password shorter than 6 characters is refused', (tester) async {
      final profile = _FakeProfile(_profile());
      await tester.pumpWidget(
        _app(const ForcePasswordChangeScreen(), profile, _FakeAuth()),
      );
      await tester.pumpAndSettle();

      await _enter(tester, current: '123456', next: '12345'); // 5 characters
      await _submit(tester);

      expect(find.text('The password must be at least 6 characters.'), findsOneWidget);
      expect(profile.calls, isEmpty);
    });

    testWidgets('a new password of exactly 6 characters is accepted', (tester) async {
      final profile = _FakeProfile(_profile());
      await tester.pumpWidget(
        _app(const ForcePasswordChangeScreen(), profile, _FakeAuth()),
      );
      await tester.pumpAndSettle();

      await _enter(tester, next: 'Abc@12'); // exactly 6 characters
      await _submit(tester);

      expect(find.textContaining('at least'), findsNothing);
      expect(profile.calls, ['change(Temp@2026->Abc@12)', 'mark']);
      expect(profile.state.requireValue!.requiresPasswordChange, isFalse);
    });

    testWidgets('the too-short message is shown in Arabic with 6', (tester) async {
      final profile = _FakeProfile(_profile());
      await tester.pumpWidget(
        _app(
          const ForcePasswordChangeScreen(),
          profile,
          _FakeAuth(),
          locale: const Locale('ar'),
        ),
      );
      await tester.pumpAndSettle();

      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Temp@2026');
      await tester.enterText(fields.at(1), 'Abc@1');
      await tester.enterText(fields.at(2), 'Abc@1');
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();

      expect(find.text('يجب ألا تقل كلمة المرور عن 6 أحرف.'), findsOneWidget);
      expect(profile.calls, isEmpty);
    });

    testWidgets('the confirmation must match', (tester) async {
      final profile = _FakeProfile(_profile());
      await tester.pumpWidget(
        _app(const ForcePasswordChangeScreen(), profile, _FakeAuth()),
      );
      await tester.pumpAndSettle();

      await _enter(tester, confirm: 'Different@2026');
      await _submit(tester);

      expect(find.text('The passwords do not match.'), findsOneWidget);
      expect(profile.calls, isEmpty);
    });

    testWidgets('keeping the temporary password is accepted (new == temporary)',
        (tester) async {
      final profile = _FakeProfile(_profile());
      await tester.pumpWidget(
        _app(const ForcePasswordChangeScreen(), profile, _FakeAuth()),
      );
      await tester.pumpAndSettle();

      await _enter(tester, current: '123456', next: '123456');
      await _submit(tester);

      expect(find.textContaining('different'), findsNothing);
      expect(find.textContaining('at least'), findsNothing);
      expect(profile.calls, ['change(123456->123456)', 'mark']);
      // The gate still had to be completed: the flag is cleared only now.
      expect(profile.state.requireValue!.requiresPasswordChange, isFalse);
    });

    testWidgets('choosing a different password is accepted (new != temporary)',
        (tester) async {
      final profile = _FakeProfile(_profile());
      await tester.pumpWidget(
        _app(const ForcePasswordChangeScreen(), profile, _FakeAuth()),
      );
      await tester.pumpAndSettle();

      await _enter(tester, current: '123456', next: 'abc123');
      await _submit(tester);

      expect(profile.calls, ['change(123456->abc123)', 'mark']);
      expect(profile.state.requireValue!.requiresPasswordChange, isFalse);
    });

    testWidgets('a temporary password that Firebase rejects still blocks the change',
        (tester) async {
      final profile = _FakeProfile(
        _profile(),
        changeError: 'Current password is incorrect.',
      );
      await tester.pumpWidget(
        _app(const ForcePasswordChangeScreen(), profile, _FakeAuth()),
      );
      await tester.pumpAndSettle();

      // Same value in both fields is fine, but the temporary one must be right.
      await _enter(tester, current: '123456', next: '123456');
      await _submit(tester);

      expect(find.text('Current password is incorrect.'), findsOneWidget);
      expect(profile.state.requireValue!.requiresPasswordChange, isTrue);
    });

    testWidgets('the user can sign out instead', (tester) async {
      final auth = _FakeAuth();
      await tester.pumpWidget(
        _app(const ForcePasswordChangeScreen(), _FakeProfile(_profile()), auth),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(OutlinedButton, 'Sign out'));
      await tester.pump();
      expect(auth.signOuts, 1);
    });

    testWidgets('shows Arabic text in RTL', (tester) async {
      await tester.pumpWidget(
        _app(
          const ForcePasswordChangeScreen(),
          _FakeProfile(_profile()),
          _FakeAuth(),
          locale: const Locale('ar'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('اختر كلمة مرور جديدة'), findsWidgets);
      expect(
        Directionality.of(tester.element(find.byType(ForcePasswordChangeScreen))),
        TextDirection.rtl,
      );
    });
  });
}
