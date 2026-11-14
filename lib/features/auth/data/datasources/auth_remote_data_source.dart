import '../models/auth_user_model.dart';

abstract class AuthRemoteDataSource {
  Stream<AuthUserModel?> authStateChanges();

  AuthUserModel? get currentUser;

  Future<AuthUserModel> signInWithEmail({
    required String email,
    required String password,
  });

  Future<AuthUserModel> signUpWithEmail({
    required String email,
    required String password,
  });

  /// Signs in with Google. Returns the authenticated user along with
  /// whether this was their first sign-in and their Google display name,
  /// so the caller can decide whether to bootstrap a Firestore profile.
  Future<({AuthUserModel user, bool isNewUser, String? displayName})>
      signInWithGoogle();

  Future<void> signOut();

  Future<void> deleteCurrentUser();

  /// Sends (or re-sends) Firebase's verification email to the signed-in user.
  Future<void> sendEmailVerification();

  /// Sends Firebase's password-reset email to [email], in [languageCode].
  Future<void> sendPasswordResetEmail({
    required String email,
    String? languageCode,
  });

  /// Reloads the signed-in Firebase user so a freshly verified email is
  /// reflected, returning the refreshed user (null when signed out).
  Future<AuthUserModel?> reloadCurrentUser();
}
