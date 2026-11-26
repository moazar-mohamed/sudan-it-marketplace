import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/data/profile_cache.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/auth_user.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/auth_repository.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/user_profile_repository.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_controller.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_providers.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_state.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';

const _user = AuthUser(id: 'u1', email: 'u1@example.test', emailVerified: true);

UserProfile _profile(String name) => UserProfile(
  id: 'u1',
  fullName: name,
  email: 'u1@example.test',
  role: UserRole.customer,
  isActive: true,
  createdAt: DateTime(2026, 1, 1),
);

class _Auth extends Fake implements AuthRepository {
  @override
  Stream<AuthUser?> authStateChanges() => Stream.value(_user);

  @override
  AuthUser? get currentUser => _user;
}

/// The server: answers only when [answer] completes.
class _SlowServer extends Fake implements UserProfileRepository {
  final answer = Completer<UserProfile?>();
  int calls = 0;

  @override
  Future<UserProfile?> fetchOrCreateCustomerProfile({
    required String userId,
    required String fullName,
    required String email,
  }) {
    calls++;
    return answer.future;
  }
}

Future<ProviderContainer> _container(_SlowServer server, UserProfile? saved) async {
  final container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(_Auth()),
      userProfileRepositoryProvider.overrideWithValue(server),
      signedInFirebaseUserProvider.overrideWith((ref) => null),
      cachedProfileReaderProvider.overrideWithValue((_) async => saved),
    ],
  );
  addTearDown(container.dispose);
  container.listen(profileControllerProvider, (_, _) {});
  // Let the auth stream report the signed-in person.
  for (var i = 0; i < 5 && container.read(authControllerProvider) is! AuthAuthenticated; i++) {
    await Future<void>.delayed(Duration.zero);
  }
  return container;
}

void main() {
  test('opens at once on the saved profile, then takes the server copy', () async {
    final server = _SlowServer();
    final container = await _container(server, _profile('Saved name'));

    final first = await container.read(profileControllerProvider.future);
    expect(first?.fullName, 'Saved name');
    expect(server.calls, 1, reason: 'the server copy is still asked for');

    server.answer.complete(_profile('Server name'));
    await Future<void>.delayed(Duration.zero);
    expect(container.read(profileControllerProvider).value?.fullName, 'Server name');
  });

  test('with nothing saved (first sign-in) it waits for the server', () async {
    final server = _SlowServer();
    final container = await _container(server, null);

    final pending = container.read(profileControllerProvider.future);
    var done = false;
    unawaited(pending.then((_) => done = true));
    await Future<void>.delayed(Duration.zero);
    expect(done, isFalse);

    server.answer.complete(_profile('Server name'));
    expect((await pending)?.fullName, 'Server name');
  });

  test('a server failure keeps the saved profile', () async {
    final server = _SlowServer();
    final container = await _container(server, _profile('Saved name'));
    await container.read(profileControllerProvider.future);

    server.answer.completeError(Exception('offline'));
    await Future<void>.delayed(Duration.zero);
    expect(container.read(profileControllerProvider).value?.fullName, 'Saved name');
  });
}
