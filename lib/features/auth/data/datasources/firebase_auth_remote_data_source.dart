import 'package:firebase_auth/firebase_auth.dart';

import '../../domain/exceptions/auth_exception.dart';
import '../models/auth_user_model.dart';
import 'auth_remote_data_source.dart';

class FirebaseAuthRemoteDataSource implements AuthRemoteDataSource {
  FirebaseAuthRemoteDataSource({FirebaseAuth? firebaseAuth})
    : _firebaseAuth = firebaseAuth ?? FirebaseAuth.instance;

  final FirebaseAuth _firebaseAuth;

  @override
  Stream<AuthUserModel?> authStateChanges() {
    return _firebaseAuth.authStateChanges().map(_mapUser);
  }

  @override
  AuthUserModel? get currentUser => _mapUser(_firebaseAuth.currentUser);

  @override
  Future<AuthUserModel> signInWithEmail({
    required String email,
    required String password,
  }) {
    return _run(() async {
      final credential = await _firebaseAuth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      return _requireUser(credential.user);
    });
  }

  @override
  Future<AuthUserModel> signUpWithEmail({
    required String email,
    required String password,
  }) {
    return _run(() async {
      final credential = await _firebaseAuth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      return _requireUser(credential.user);
    });
  }

  @override
  Future<({AuthUserModel user, bool isNewUser, String? displayName})>
      signInWithGoogle() {
    return _run(() async {
      final credential = await _firebaseAuth.signInWithProvider(
        GoogleAuthProvider(),
      );
      final user = _requireUser(credential.user);
      return (
        user: user,
        isNewUser: credential.additionalUserInfo?.isNewUser ?? false,
        displayName: credential.user?.displayName,
      );
    });
  }

  @override
  Future<void> signOut() {
    return _run(_firebaseAuth.signOut);
  }

  @override
  Future<void> deleteCurrentUser() {
    return _run(() async {
      final user = _firebaseAuth.currentUser;
      if (user == null) {
        return;
      }
      await user.delete();
    });
  }

  Future<T> _run<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on AuthException {
      rethrow;
    } on FirebaseAuthException catch (error) {
      // DIAG: FirebaseAuthException swallowed here
      // ignore: avoid_print
      print('[DIAG][FirebaseAuthDS] FirebaseAuthException code=${error.code} message=${error.message}');
      throw AuthException(_messageForCode(error.code), code: error.code);
    } catch (error, st) {
      // DIAG: Unknown exception swallowed here
      // ignore: avoid_print
      print('[DIAG][FirebaseAuthDS] Unknown error type=${error.runtimeType} error=$error\n$st');
      throw const AuthException(
        'Authentication failed. Please try again.',
        code: 'unknown',
      );
    }
  }

  AuthUserModel _requireUser(User? user) {
    final mapped = _mapUser(user);
    if (mapped == null) {
      throw const AuthException(
        'Authentication succeeded but no user was returned.',
        code: 'user-missing',
      );
    }
    return mapped;
  }

  AuthUserModel? _mapUser(User? user) {
    if (user == null) {
      return null;
    }
    return AuthUserModel.fromFirebaseUser(user);
  }

  String _messageForCode(String code) {
    switch (code) {
      case 'email-already-in-use':
        return 'This email is already registered.';
      case 'invalid-email':
        return 'Enter a valid email address.';
      case 'weak-password':
        return 'Choose a stronger password.';
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'Invalid email or password.';
      case 'user-disabled':
        return 'This account has been disabled.';
      case 'too-many-requests':
        return 'Too many attempts. Please wait and try again.';
      case 'network-request-failed':
        return 'Network error. Check your connection and try again.';
      case 'operation-not-allowed':
        return 'Email and password sign-in is not enabled.';
      case 'canceled':
      case 'popup-closed-by-user':
      case 'web-context-canceled':
        return 'Sign-in was cancelled.';
      case 'account-exists-with-different-credential':
        return 'An account already exists with a different sign-in method for this email.';
      default:
        return 'Authentication failed. Please try again.';
    }
  }
}
