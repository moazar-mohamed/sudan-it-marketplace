import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/auth_user.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/auth_repository.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/customer_profile_screen.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';

const _user =
    AuthUser(id: 'cust1', email: 'customer@example.test', emailVerified: true);

final _profile = UserProfile(
  id: 'cust1',
  fullName: 'Moazer Mohamed',
  email: 'customer@example.test',
  role: UserRole.customer,
  createdAt: DateTime(2026),
  isActive: true,
);

class _FakeAuthRepository extends Fake implements AuthRepository {
  @override
  Stream<AuthUser?> authStateChanges() => Stream.value(_user);

  @override
  AuthUser? get currentUser => _user;
}

class _FakeProfileController extends ProfileController {
  _FakeProfileController(this.answer);

  /// What changePassword returns: null for success, else the error message.
  final String? answer;
  final calls = <(String, String)>[];

  @override
  Future<UserProfile?> build() async => _profile;

  @override
  Future<String?> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    calls.add((currentPassword, newPassword));
    return answer;
  }
}

Future<_FakeProfileController> _openSheet(
  WidgetTester tester, {
  String? answer,
}) async {
  final controller = _FakeProfileController(answer);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
        signedInFirebaseUserProvider.overrideWith((ref) => null),
        profileControllerProvider.overrideWith(() => controller),
      ],
      child: const MaterialApp(home: Scaffold(body: CustomerProfileScreen())),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Change password'));
  await tester.pumpAndSettle();
  expect(find.text('Update password'), findsOneWidget);
  return controller;
}

Future<void> _fill(WidgetTester tester, String current, String next) async {
  final fields = find.byType(TextFormField);
  await tester.enterText(fields.at(fields.evaluate().length - 3), current);
  await tester.enterText(fields.at(fields.evaluate().length - 2), next);
  await tester.enterText(fields.at(fields.evaluate().length - 1), next);
}

void main() {
  // Tapping "Change password" in the customer profile, then closing the
  // sheet, turned the app into a red "_dependents.isEmpty" screen: the text
  // fields' controllers were thrown away while the sheet was still sliding
  // shut.
  testWidgets('closing the sheet without changing anything is clean',
      (tester) async {
    final controller = await _openSheet(tester);

    await tester.tapAt(const Offset(20, 20)); // outside the sheet
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Update password'), findsNothing);
    expect(controller.calls, isEmpty);
  });

  testWidgets('a successful change closes the sheet and says so',
      (tester) async {
    final controller = await _openSheet(tester);

    await _fill(tester, 'old-secret', 'new-secret');
    await tester.tap(find.text('Update password'));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(controller.calls, [('old-secret', 'new-secret')]);
    expect(find.text('Update password'), findsNothing);
    expect(find.text('Password changed successfully.'), findsOneWidget);
  });

  testWidgets('a refused change keeps the sheet open with the reason in it',
      (tester) async {
    await _openSheet(tester, answer: 'The current password is incorrect.');

    await _fill(tester, 'wrong', 'new-secret');
    await tester.tap(find.text('Update password'));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Update password'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(BottomSheet),
        matching: find.text('The current password is incorrect.'),
      ),
      findsOneWidget,
    );
  });
}
