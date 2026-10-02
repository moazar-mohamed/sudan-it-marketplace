import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/data/datasources/firebase_auth_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/auth/domain/exceptions/auth_exception.dart';

// Placing an order needs `email_verified` in the ID token (ORD-4). The token
// a customer holds when they verify their e-mail was issued before, and says
// false for up to an hour; reloading the user does not change it. So when a
// reload shows the e-mail verified, a new token is fetched at once.

/// A signed-in Firebase user whose e-mail becomes verified on [reload] when
/// [verifiedOnServer] is true. Records the calls in order.
class _User extends Fake implements User {
  _User({this.verified = false, this.verifiedOnServer = false});

  bool verified;
  bool verifiedOnServer;
  FirebaseAuthException? tokenError;
  final calls = <String>[];

  @override
  String get uid => 'cust1';

  @override
  String? get email => 'cust1@example.test';

  @override
  bool get emailVerified => verified;

  @override
  Future<void> reload() async {
    calls.add('reload');
    verified = verifiedOnServer;
  }

  @override
  Future<String?> getIdToken([bool forceRefresh = false]) async {
    calls.add(forceRefresh ? 'new token' : 'cached token');
    if (tokenError != null) throw tokenError!;
    return 'token';
  }
}

class _Auth extends Fake implements FirebaseAuth {
  _Auth(this.currentUser);

  @override
  final User? currentUser;
}

void main() {
  group('checking the e-mail verification again', () {
    test('just verified: the user is reloaded, then a NEW token is fetched',
        () async {
      final user = _User(verifiedOnServer: true);
      final auth = FirebaseAuthRemoteDataSource(firebaseAuth: _Auth(user));

      final reloaded = await auth.reloadCurrentUser();

      expect(reloaded!.emailVerified, isTrue);
      expect(user.calls, ['reload', 'new token']);
    });

    test('still not verified: no token is fetched (it would say the same)',
        () async {
      final user = _User();
      final auth = FirebaseAuthRemoteDataSource(firebaseAuth: _Auth(user));

      final reloaded = await auth.reloadCurrentUser();

      expect(reloaded!.emailVerified, isFalse);
      expect(user.calls, ['reload']);
    });

    test('verified long ago: the token is refreshed too, which is harmless',
        () async {
      final user = _User(verified: true, verifiedOnServer: true);
      final auth = FirebaseAuthRemoteDataSource(firebaseAuth: _Auth(user));

      await auth.reloadCurrentUser();

      expect(user.calls, ['reload', 'new token']);
    });

    test('signed out: nothing to reload', () async {
      final auth = FirebaseAuthRemoteDataSource(firebaseAuth: _Auth(null));
      expect(await auth.reloadCurrentUser(), isNull);
    });

    test('a failed token refresh is reported, not taken as verified', () async {
      final user = _User(verifiedOnServer: true)
        ..tokenError = FirebaseAuthException(code: 'network-request-failed');
      final auth = FirebaseAuthRemoteDataSource(firebaseAuth: _Auth(user));

      await expectLater(
        auth.reloadCurrentUser(),
        throwsA(isA<AuthException>()
            .having((e) => e.code, 'code', 'network-request-failed')),
      );
    });
  });
}
