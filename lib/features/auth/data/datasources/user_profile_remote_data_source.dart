import '../../domain/entities/user_profile.dart';

abstract class UserProfileRemoteDataSource {
  Future<void> createCustomerProfile({
    required String id,
    required String fullName,
    required String email,
  });

  Future<UserProfile?> fetchProfile(String userId);

  Future<void> updateProfile({
    required String userId,
    required String fullName,
    String? phone,
  });
}
