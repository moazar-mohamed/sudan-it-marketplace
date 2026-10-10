import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/auth_user.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/exceptions/auth_exception.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/auth_repository.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/user_profile_repository.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_gate.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_providers.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/deleted_account.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/customer_dashboard_screen.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

const _user = AuthUser(id: 'cust1', email: 'gone@example.test', emailVerified: true);

/// A person who is already signed in, as after an app restart.
class _SignedInAuthRepository extends Fake implements AuthRepository {
  @override
  Stream<AuthUser?> authStateChanges() async* {
    yield _user;
  }

  @override
  AuthUser? get currentUser => _user;
}

/// Like the real repository for an account with no profile that cannot make
/// one: the security rules refuse it, so the profile read ends in an error.
class _NoProfileRepository extends Fake implements UserProfileRepository {
  @override
  Future<UserProfile?> fetchOrCreateCustomerProfile({
    required String userId,
    required String fullName,
    required String email,
  }) async {
    throw const AuthException(
      'Could not save your profile. Please try again.',
      code: 'permission-denied',
    );
  }
}

Widget _app({required bool deleted}) => ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(_SignedInAuthRepository()),
        userProfileRepositoryProvider.overrideWithValue(_NoProfileRepository()),
        signedInFirebaseUserProvider.overrideWith((ref) => null),
        accountDeletedProvider('cust1').overrideWith((ref) async => deleted),
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
    );

void main() {
  final en = AppLocalizationsEn();

  testWidgets('an account Platform Admin deleted is told so, not shown the app',
      (tester) async {
    await tester.pumpWidget(_app(deleted: true));
    await tester.pumpAndSettle();

    expect(find.text(en.authAccountDeletedTitle), findsOneWidget);
    expect(find.text(en.authAccountDeletedMessage), findsOneWidget);
    expect(find.byType(CustomerDashboardScreen), findsNothing);
    // They can still leave: the sign-out button is on the screen.
    expect(find.text(en.commonSignOut), findsOneWidget);
  });

  testWidgets('a profile problem on an account that was not deleted is shown as before',
      (tester) async {
    await tester.pumpWidget(_app(deleted: false));
    await tester.pumpAndSettle();

    expect(find.text(en.authAccountDeletedTitle), findsNothing);
    expect(find.byType(CustomerDashboardScreen), findsOneWidget);
  });
}
