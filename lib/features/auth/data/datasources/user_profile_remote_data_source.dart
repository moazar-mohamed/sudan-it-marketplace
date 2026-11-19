import '../../domain/entities/user_profile.dart';

abstract class UserProfileRemoteDataSource {
  /// [termsVersion], when set, is stored with the acceptance time
  /// (termsVersion + termsAcceptedAt, as the rules require them together).
  Future<void> createCustomerProfile({
    required String id,
    required String fullName,
    required String email,
    int? termsVersion,
  });

  Future<UserProfile?> fetchProfile(String userId);

  /// Clears the temporary-password flag after the user chose their own.
  Future<void> markPasswordChanged(String userId);

  Future<void> updateProfile({
    required String userId,
    required String fullName,
    String? phone,
    String? photoUrl,
  });

  /// Writes only `language` (the security rules allow exactly that edit on
  /// the user's own profile).
  Future<void> updateLanguage({
    required String userId,
    required String language,
  });
}
