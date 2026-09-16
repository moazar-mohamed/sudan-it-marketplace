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
}
