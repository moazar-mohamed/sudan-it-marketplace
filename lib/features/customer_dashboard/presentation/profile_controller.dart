import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/domain/entities/user_profile.dart';
import '../../auth/domain/exceptions/auth_exception.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../auth/presentation/auth_state.dart';

// ── Profile state ──────────────────────────────────────────────────────────────

sealed class ProfileState {
  const ProfileState();
}

final class ProfileLoading extends ProfileState {
  const ProfileLoading();
}

final class ProfileLoaded extends ProfileState {
  const ProfileLoaded(this.profile);
  final UserProfile profile;
}

final class ProfileError extends ProfileState {
  const ProfileError(this.message);
  final String message;
}

// ── Profile controller ─────────────────────────────────────────────────────────

/// The Firebase account that is signed in right now (null when signed out).
/// It follows the app's auth state, and is its own provider so the profile
/// logic can be tested without a Firebase app.
final signedInFirebaseUserProvider = Provider<User?>((ref) {
  ref.watch(authControllerProvider);
  return FirebaseAuth.instance.currentUser;
});

final profileControllerProvider =
    AsyncNotifierProvider<ProfileController, UserProfile?>(
      ProfileController.new,
    );

class ProfileController extends AsyncNotifier<UserProfile?> {
  @override
  Future<UserProfile?> build() async {
    final authState = ref.watch(authControllerProvider);
    final userId = switch (authState) {
      AuthAuthenticated(:final user) => user.id,
      _ => null,
    };
    if (userId == null) return null;
    final repo = ref.read(userProfileRepositoryProvider);

    final firebaseUser = ref.watch(signedInFirebaseUserProvider);
    final accountEmail = firebaseUser?.uid == userId
        ? (firebaseUser?.email ?? '')
        : '';
    final accountName = firebaseUser?.uid == userId
        ? (firebaseUser?.displayName ?? '')
        : '';

    final profile = await repo.fetchOrCreateCustomerProfile(
      userId: userId,
      fullName: accountName,
      email: accountEmail,
    );
    if (profile != null && profile.email.isEmpty && accountEmail.isNotEmpty) {
      return profile.copyWith(email: accountEmail);
    }
    return profile;
  }

  /// Returns null on success, or an error message string.
  Future<String?> updateProfile({
    required String fullName,
    String? phone,
    String? photoUrl,
  }) async {
    final authState = ref.read(authControllerProvider);
    final userId = switch (authState) {
      AuthAuthenticated(:final user) => user.id,
      _ => null,
    };
    if (userId == null) return 'Not authenticated.';

    try {
      final repo = ref.read(userProfileRepositoryProvider);
      final trimmedPhone =
          (phone?.trim().isEmpty ?? true) ? null : phone!.trim();
      await repo.updateProfile(
        userId: userId,
        fullName: fullName.trim(),
        phone: trimmedPhone,
        photoUrl: photoUrl,
      );
      // Optimistically update state
      final current = state.asData?.value;
      if (current != null) {
        state = AsyncData(
          current.copyWith(
            fullName: fullName.trim(),
            phone: trimmedPhone,
            photoUrl: photoUrl,
          ),
        );
      } else {
        ref.invalidateSelf();
      }
      return null;
    } on AuthException catch (e) {
      return e.message;
    } catch (_) {
      return 'Could not update profile. Please try again.';
    }
  }

  /// Clears the temporary-password flag once the user has chosen their own
  /// password. Returns null on success, or an error message string.
  Future<String?> markPasswordChanged() async {
    final authState = ref.read(authControllerProvider);
    final userId = switch (authState) {
      AuthAuthenticated(:final user) => user.id,
      _ => null,
    };
    if (userId == null) return 'Not authenticated.';

    try {
      await ref.read(userProfileRepositoryProvider).markPasswordChanged(userId);
      final current = state.asData?.value;
      if (current != null) {
        state = AsyncData(current.copyWith(mustChangePassword: false));
      } else {
        ref.invalidateSelf();
      }
      return null;
    } on AuthException catch (e) {
      return e.message;
    } catch (_) {
      return 'Could not finish setting up your account. Please try again.';
    }
  }

  /// Returns null on success, or an error message string.
  Future<String?> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final firebaseUser = FirebaseAuth.instance.currentUser;
      if (firebaseUser == null) return 'Not authenticated.';

      // Re-authenticate before changing password
      final credential = EmailAuthProvider.credential(
        email: firebaseUser.email ?? '',
        password: currentPassword,
      );
      await firebaseUser.reauthenticateWithCredential(credential);
      await firebaseUser.updatePassword(newPassword);
      return null;
    } on FirebaseAuthException catch (e) {
      return _messageForCode(e.code);
    } catch (_) {
      return 'Could not change password. Please try again.';
    }
  }

  static String _messageForCode(String code) {
    switch (code) {
      case 'wrong-password':
      case 'invalid-credential':
        return 'Current password is incorrect.';
      case 'weak-password':
        return 'New password is too weak. Use at least 6 characters.';
      case 'requires-recent-login':
        return 'Please sign out and sign back in before changing your password.';
      case 'too-many-requests':
        return 'Too many attempts. Please wait and try again.';
      default:
        return 'Could not change password. Please try again.';
    }
  }
}
