import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/auth_user.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/auth_repository.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/user_profile_repository.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_controller.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_gate.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_providers.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/login_screen.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/customer_dashboard_screen.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';

const _unverified =
    AuthUser(id: 'cust1', email: 'new@example.test', emailVerified: false);

final _profile = UserProfile(
  id: 'cust1',
  fullName: 'New Customer',
  email: 'new@example.test',
  role: UserRole.customer,
  createdAt: DateTime(2026),
  isActive: true,
);

/// Like FirebaseAuth after createUserWithEmailAndPassword: the new user is
/// announced on the auth stream, and is not verified yet.
class _FakeAuthRepository extends Fake implements AuthRepository {
  AuthUser? _user;
  final _changes = StreamController<AuthUser?>.broadcast();

  @override
  Stream<AuthUser?> authStateChanges() async* {
    yield _user;
    yield* _changes.stream;
  }

  @override
  AuthUser? get currentUser => _user;

  @override
  Future<AuthUser> signUpWithEmail({
    required String fullName,
    required String email,
    required String password,
  }) async {
    _user = _unverified;
    _changes.add(_user);
    return _unverified;
  }
}

class _FakeProfileRepository extends Fake implements UserProfileRepository {
  @override
  Future<UserProfile?> fetchOrCreateCustomerProfile({
    required String userId,
    required String fullName,
    required String email,
  }) async =>
      _profile;
}

void main() {
  testWidgets(
      'a customer who just signed up with an unverified e-mail is held on the '
      'verification screen, not the Home', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          userProfileRepositoryProvider
              .overrideWithValue(_FakeProfileRepository()),
          signedInFirebaseUserProvider.overrideWith((ref) => null),
          firestoreProductsStreamProvider
              .overrideWith((ref) => Stream.value(const [])),
          firestoreCompaniesStreamProvider
              .overrideWith((ref) => Stream.value(const [])),
          customerOrdersStreamProvider
              .overrideWith((ref) => Stream.value(const [])),
          customerChatsStreamProvider
              .overrideWith((ref) => Stream.value(const [])),
        ],
        child: const MaterialApp(home: AuthGate()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget);

    await ProviderScope.containerOf(tester.element(find.byType(AuthGate)))
        .read(authControllerProvider.notifier)
        .signUpWithEmail(
          fullName: 'New Customer',
          email: 'new@example.test',
          password: 'secret1',
        );
    await tester.pumpAndSettle();

    expect(find.byType(CustomerDashboardScreen), findsNothing);
    expect(find.byIcon(Icons.mark_email_unread_outlined), findsOneWidget);
  });
}
