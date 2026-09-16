import '../entities/auth_user.dart';

abstract class AuthRepository {
  Stream<AuthUser?> authStateChanges();

  AuthUser? get currentUser;

  Future<AuthUser> signInWithEmail({
    required String email,
    required String password,
  });

  Future<AuthUser> signUpWithEmail({
    required String fullName,
    required String email,
    required String password,
  });

  Future<AuthUser> signInWithGoogle();

  Future<void> signOut();
}
