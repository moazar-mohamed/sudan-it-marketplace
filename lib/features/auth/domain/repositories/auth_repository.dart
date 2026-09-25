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

  /// Sends (or re-sends) Firebase's verification email to the signed-in user.
  Future<void> sendEmailVerification();

  /// Sends Firebase's password-reset email to [email]. [languageCode] ('en' or
  /// 'ar') picks the language of the email. Throws [AuthException] on failure;
  /// note that Firebase may report success for an address with no account.
  Future<void> sendPasswordResetEmail({
    required String email,
    String? languageCode,
  });

  /// Reloads the signed-in Firebase user so a freshly verified email is
  /// reflected, returning the refreshed user (null when signed out).
  Future<AuthUser?> reloadCurrentUser();
}
