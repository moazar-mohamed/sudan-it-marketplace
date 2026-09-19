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
      // Security rules require a non-empty email to create a customer
      // profile, and there is none on the signed-in Firebase Auth account
      // (e.g. a provider that didn't share it). Surface this instead of
      // silently returning null, which the UI cannot distinguish from a
      // genuine lookup failure.
      throw const AuthException(
        'Your account has no email on file, so a profile could not be '
        'created. Please contact support.',
        code: 'profile-missing-email',
      );
    }
    try {
      await _remoteDataSource.createCustomerProfile(
        id: userId,
        fullName: fullName.trim().isEmpty ? email.split('@').first : fullName,
        email: email.trim(),
      );
    } on AuthException {
      // Another flow (sign-up / Google sign-in) may have created it at the
      // same moment; only swallow this if that turns out to be true.
      final createdConcurrently = await fetchProfile(userId);
      if (createdConcurrently != null) {
        return createdConcurrently;
      }
      rethrow;
    }
    return fetchProfile(userId);
  }

  @override
  Future<void> markPasswordChanged(String userId) async {
    try {
      await _remoteDataSource.markPasswordChanged(userId);
    } on AuthException {
      rethrow;
    } catch (_) {
      throw const AuthException(
        'Could not finish setting up your account. Please try again.',
        code: 'password-flag-update-failed',
      );
    }
  }

  @override
  Future<void> updateProfile({
    required String userId,
    required String fullName,
    String? phone,
    String? photoUrl,
  }) async {
    try {
      await _remoteDataSource.updateProfile(
        userId: userId,
        fullName: fullName,
        phone: phone,
        photoUrl: photoUrl,
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
