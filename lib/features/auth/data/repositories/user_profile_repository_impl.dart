import '../../domain/entities/user_profile.dart';
import '../../domain/exceptions/auth_exception.dart';
import '../../domain/repositories/user_profile_repository.dart';
import '../datasources/user_profile_remote_data_source.dart';

class UserProfileRepositoryImpl implements UserProfileRepository {
  UserProfileRepositoryImpl(this._remoteDataSource);

  final UserProfileRemoteDataSource _remoteDataSource;

  @override
  Future<void> createCustomerProfile({
    required String id,
    required String fullName,
    required String email,
  }) async {
    try {
      await _remoteDataSource.createCustomerProfile(
        id: id,
        fullName: fullName,
        email: email,
      );
    } on AuthException {
      rethrow;
    } catch (_) {
      throw const AuthException(
        'Could not save your profile. Please try again.',
        code: 'profile-create-failed',
      );
    }
  }

  @override
  Future<UserProfile?> fetchProfile(String userId) async {
    try {
      return await _remoteDataSource.fetchProfile(userId);
    } on AuthException {
      rethrow;
    } catch (error, st) {
      // ignore: avoid_print
      print('[DIAG][UserProfileRepoImpl] fetchProfile error=$error\n$st');
      throw const AuthException(
        'Could not load your profile. Please try again.',
        code: 'profile-fetch-failed',
      );
    }
  }

  @override
  Future<UserProfile?> fetchOrCreateCustomerProfile({
    required String userId,
    required String fullName,
    required String email,
  }) async {
    final existing = await fetchProfile(userId);
    if (existing != null) {
      return existing;
    }
    if (email.trim().isEmpty) {
      // Security rules require an email to create a customer profile.
      return null;
    }
    try {
      await _remoteDataSource.createCustomerProfile(
        id: userId,
        fullName: fullName.trim().isEmpty ? email.split('@').first : fullName,
        email: email.trim(),
      );
    } on AuthException {
      // Another flow (sign-up / Google sign-in) may have created it at the
      // same moment; read again below before reporting a missing profile.
    }
    return fetchProfile(userId);
  }

  @override
  Future<void> updateProfile({
    required String userId,
    required String fullName,
    String? phone,
  }) async {
    try {
      await _remoteDataSource.updateProfile(
        userId: userId,
        fullName: fullName,
        phone: phone,
      );
    } on AuthException {
      rethrow;
    } catch (error, st) {
      // ignore: avoid_print
      print('[DIAG][UserProfileRepoImpl] updateProfile error=$error\n$st');
      throw const AuthException(
        'Could not update your profile. Please try again.',
        code: 'profile-update-failed',
      );
    }
  }
}
