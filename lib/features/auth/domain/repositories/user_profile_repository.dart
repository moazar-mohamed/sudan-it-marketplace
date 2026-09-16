import '../entities/user_profile.dart';

abstract class UserProfileRepository {
  Future<void> createCustomerProfile({
    required String id,
    required String fullName,
    required String email,
  });

  Future<UserProfile?> fetchProfile(String userId);

  /// Returns the stored profile. If the signed-in user has no profile
  /// document yet (e.g. the account was created before Firestore was set up,
  /// or the first Google sign-in could not save it), a customer profile is
  /// created from the account details and returned.
  Future<UserProfile?> fetchOrCreateCustomerProfile({
    required String userId,
    required String fullName,
    required String email,
  });

  Future<void> updateProfile({
    required String userId,
    required String fullName,
    String? phone,
  });
}
