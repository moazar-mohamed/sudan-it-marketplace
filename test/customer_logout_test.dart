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
import 'package:sudan_it_marketplace/features/auth/presentation/auth_state.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/login_screen.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/customer_dashboard_screen.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/customer_profile_screen.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_pending_verification_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';

const _notFound = 'Your profile could not be found.';
const _customerAuth =
    AuthUser(id: 'cust1', email: 'customer@example.test', emailVerified: true);

final _customerProfile = UserProfile(
  id: 'cust1',
  fullName: 'Moazer Mohamed',
  email: 'customer@example.test',
  role: UserRole.customer,
  createdAt: DateTime(2026),
  isActive: true,
);

final _order = OrderEntity(
  id: 'o1',
  customerId: 'cust1',
  companyId: 'c1',
  productId: 'p1',
  productName: 'Router',
  quantity: 1,
  unitPrice: 100,
  productSubtotal: 100,
  installationSelected: false,
  installationFee: 0,
  deliveryFee: 0,
  totalAmount: 100,
  deliveryAddress: 'Street 1',
  contactPhone: '0911111111',
  createdAt: DateTime(2026),
);

/// Behaves like FirebaseAuth as far as the app can tell: it announces the
/// current user when listened to, and announces `null` after signOut().
class _FakeAuthRepository extends Fake implements AuthRepository {
  _FakeAuthRepository({AuthUser? signedInAs}) : _user = signedInAs;

  AuthUser? _user;
  final _changes = StreamController<AuthUser?>.broadcast();
  int signOuts = 0;

  @override
  Stream<AuthUser?> authStateChanges() async* {
    yield _user;
    yield* _changes.stream;
  }

  @override
  AuthUser? get currentUser => _user;

  @override
  Future<AuthUser> signInWithEmail({
    required String email,
    required String password,
  }) async {
    _user = _customerAuth;
    _changes.add(_user);
    return _customerAuth;
  }

  @override
  Future<void> signOut() async {
    signOuts++;
    await Future<void>.delayed(const Duration(milliseconds: 5));
    _user = null;
    _changes.add(null);
  }
}

/// Stands in for users/{uid}. [profile] null means "no such document".
class _FakeProfileRepository extends Fake implements UserProfileRepository {
  _FakeProfileRepository(this.profile);

  UserProfile? profile;
  final requestedFor = <String>[];

  @override
  Future<UserProfile?> fetchOrCreateCustomerProfile({
    required String userId,
    required String fullName,
    required String email,
  }) async {
    requestedFor.add(userId);
    return profile;
  }
}

class _Harness {
  _Harness(this.auth, this.profiles);

  final _FakeAuthRepository auth;
  final _FakeProfileRepository profiles;

  Widget build() => ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(auth),
          userProfileRepositoryProvider.overrideWithValue(profiles),
          signedInFirebaseUserProvider.overrideWith((ref) => null),
          // The dashboard's Firestore-backed lists are not under test.
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
}

ProviderContainer _container(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(AuthGate)));

Future<void> _openProfileTab(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(NavigationDestination, 'Profile'));
  await tester.pumpAndSettle();
}

Future<void> _tapSignOutOnProfile(WidgetTester tester) async {
  final signOut = find.text('Sign out');
  await tester.scrollUntilVisible(
    signOut,
    200,
    // The profile list itself (the first, outermost scrollable in the screen).
    scrollable: find
        .descendant(
          of: find.byType(CustomerProfileScreen),
          matching: find.byType(Scrollable),
        )
        .first,
  );
  await tester.tap(signOut);
}

/// Signs a customer in and lands on their profile tab, as a real session would.
Future<_Harness> _signedInOnProfile(
  WidgetTester tester, {
  UserProfile? profile,
  bool profileMissing = false,
}) async {
  final harness = _Harness(
    _FakeAuthRepository(),
    _FakeProfileRepository(profileMissing ? null : (profile ?? _customerProfile)),
  );
  await tester.pumpWidget(harness.build());
  await tester.pumpAndSettle();
  expect(find.byType(LoginScreen), findsOneWidget);

  await _container(tester)
      .read(authControllerProvider.notifier)
      .signInWithEmail(email: 'customer@example.test', password: 'secret1');
  await tester.pumpAndSettle();
  expect(find.byType(CustomerDashboardScreen), findsOneWidget);
  await _openProfileTab(tester);
  return harness;
}

/// Taps Sign out and checks EVERY frame until the app settles.
Future<void> _signOutAndExpectLogin(WidgetTester tester, _Harness harness) async {
  await _tapSignOutOnProfile(tester);
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 5));
    expect(find.text(_notFound), findsNothing, reason: 'frame $i shows the not-found state');
  }
  await tester.pumpAndSettle();

  expect(harness.auth.signOuts, 1);
  expect(_container(tester).read(authControllerProvider), isA<AuthUnauthenticated>());
  expect(find.byType(LoginScreen), findsOneWidget);
  expect(find.byType(CustomerDashboardScreen), findsNothing);
  expect(find.text(_notFound), findsNothing);
  expect(find.text('Try again'), findsNothing);
}

/// Places the "order confirmed" screen on top, as the payment screen does, and
/// taps one of its buttons, which is what the customer does after ordering.
Future<void> _afterOrderTap(WidgetTester tester, String button) async {
  final navigator = tester.state<NavigatorState>(find.byType(Navigator).first);
  navigator.push(
    MaterialPageRoute<void>(
      builder: (_) => OrderPendingVerificationScreen(order: _order),
    ),
  );
  await tester.pumpAndSettle();
  final target = find.text(button);
  await tester.scrollUntilVisible(
    target,
    200,
    scrollable: find
        .descendant(
          of: find.byType(OrderPendingVerificationScreen),
          matching: find.byType(Scrollable),
        )
        .first,
  );
  await tester.tap(target);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('signing out from the customer profile reaches the login screen',
      (tester) async {
    final harness = await _signedInOnProfile(tester);
    expect(find.text('My profile'), findsOneWidget);
    expect(find.text('Moazer Mohamed'), findsWidgets);
    expect(harness.profiles.requestedFor, isNotEmpty);

    await _signOutAndExpectLogin(tester, harness);
  });

  testWidgets(
      'after placing an order and going "Back to Marketplace", signing out '
      'still reaches the login screen', (tester) async {
    final harness = await _signedInOnProfile(tester);
    await _afterOrderTap(tester, 'Back to Marketplace');
    expect(find.byType(CustomerDashboardScreen), findsOneWidget);
    await _openProfileTab(tester);

    await _signOutAndExpectLogin(tester, harness);
  });

  testWidgets(
      'after placing an order and going to "View in My Orders", signing out '
      'still reaches the login screen', (tester) async {
    final harness = await _signedInOnProfile(tester);
    await _afterOrderTap(tester, 'View in My Orders');
    expect(find.text('My Orders'), findsWidgets); // landed on the orders tab
    await _openProfileTab(tester);

    await _signOutAndExpectLogin(tester, harness);
  });

  testWidgets('a signed-in customer whose profile is genuinely missing still gets the not-found state',
      (tester) async {
    await _signedInOnProfile(tester, profileMissing: true);

    expect(find.text(_notFound), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
    expect(find.byType(LoginScreen), findsNothing);
  });

  testWidgets('a customer with a missing profile can still sign out to the login screen',
      (tester) async {
    final harness = await _signedInOnProfile(tester, profileMissing: true);
    expect(find.text(_notFound), findsOneWidget);

    await tester.tap(find.text('Sign out'));
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 5));
    }
    await tester.pumpAndSettle();

    expect(harness.auth.signOuts, 1);
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.text(_notFound), findsNothing);
  });

  testWidgets(
      'the profile screen never claims a profile is missing while nobody is signed in',
      (tester) async {
    // A profile screen with no AuthGate above it and a signed-out app.
    final harness = _Harness(_FakeAuthRepository(), _FakeProfileRepository(null));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(harness.auth),
          userProfileRepositoryProvider.overrideWithValue(harness.profiles),
          signedInFirebaseUserProvider.overrideWith((ref) => null),
        ],
        child: const MaterialApp(home: Scaffold(body: CustomerProfileScreen())),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text(_notFound), findsNothing);
    expect(find.text('Try again'), findsNothing);
  });
}
