import '../../domain/entities/auth_user.dart';
import '../../domain/exceptions/auth_exception.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/repositories/user_profile_repository.dart';
import '../datasources/auth_remote_data_source.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._remoteDataSource, this._userProfileRepository);

  final AuthRemoteDataSource _remoteDataSource;
  final UserProfileRepository _userProfileRepository;

  @override
  Stream<AuthUser?> authStateChanges() {
    return _remoteDataSource.authStateChanges().map(
      (user) => user?.toEntity(),
    );
  }

  @override
  AuthUser? get currentUser => _remoteDataSource.currentUser?.toEntity();

  @override
  Future<AuthUser> signInWithEmail({
    required String email,
    required String password,
  }) {
    return _run(
      () async {
        final user = await _remoteDataSource.signInWithEmail(
          email: email,
          password: password,
        );
        return user.toEntity();
      },
    );
  }

  @override
  Future<AuthUser> signUpWithEmail({
    required String fullName,
    required String email,
    required String password,
  }) {
    return _run(() async {
      final user = await _remoteDataSource.signUpWithEmail(
        email: email,
        password: password,
      );
      try {
        await _userProfileRepository.createCustomerProfile(
          id: user.id,
          fullName: fullName.trim(),
          email: (user.email ?? email).trim(),
        );
      } catch (error) {
        // The profile screen may already have created the profile for this
        // new account a moment earlier. In that case keep the account and
        // just apply the name the user entered.
        final existing = await _existingProfile(user.id);
        if (existing != null) {
          try {
            await _userProfileRepository.updateProfile(
              userId: user.id,
              fullName: fullName.trim(),
            );
          } catch (_) {}
          return user.toEntity();
        }
        try {
          await _rollbackSignUp();
        } catch (_) {
          // Ignore rollback errors; the original error takes priority.
        }
        if (error is AuthException) {
          rethrow;
        }
        throw const AuthException(
          'Could not save your profile. Please try again.',
          code: 'profile-create-failed',
        );
      }
      return user.toEntity();
    });
  }

  @override
  Future<AuthUser> signInWithGoogle() {
    return _run(() async {
      final result = await _remoteDataSource.signInWithGoogle();
      final user = result.user;
      try {
        await _userProfileRepository.fetchOrCreateCustomerProfile(
          userId: user.id,
          fullName: (result.displayName?.trim().isNotEmpty ?? false)
              ? result.displayName!.trim()
              : (user.email ?? 'Customer'),
          email: user.email ?? '',
        );
      } catch (_) {
        // The profile screen retries and surfaces any remaining error.
      }
      return user.toEntity();
    });
  }

  @override
  Future<void> signOut() {
    return _run(_remoteDataSource.signOut);
  }

  Future<Object?> _existingProfile(String userId) async {
    try {
      return await _userProfileRepository.fetchProfile(userId);
    } catch (_) {
      return null;
    }
  }

  Future<void> _rollbackSignUp() async {
    try {
      await _remoteDataSource.deleteCurrentUser();
    } catch (_) {
      try {
        await _remoteDataSource.signOut();
      } catch (_) {}
    }
  }

  Future<T> _run<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on AuthException {
      rethrow;
    } catch (error, st) {
      // DIAG: Unknown exception swallowed here
      // ignore: avoid_print
      print('[DIAG][AuthRepoImpl._run] type=${error.runtimeType} error=$error\n$st');
      throw const AuthException(
        'Authentication failed. Please try again.',
        code: 'unknown',
      );
    }
  }
}
