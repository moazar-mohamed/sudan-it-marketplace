import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/locale_controller.dart';
import '../../auth/domain/entities/user_profile.dart';
import '../../auth/domain/exceptions/auth_exception.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/auth_error_messages.dart';
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
    final l10n = ref.read(appLocalizationsProvider);
    if (userId == null) return l10n.authErrorNotAuthenticated;

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
      return authErrorMessage(l10n, e.code);
    } catch (_) {
      return l10n.errorProfileUpdate;
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
    final l10n = ref.read(appLocalizationsProvider);
    if (userId == null) return l10n.authErrorNotAuthenticated;

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
      return authErrorMessage(l10n, e.code);
    } catch (_) {
      return l10n.errorSetupAccount;
    }
  }

  /// Returns null on success, or an error message string.
  Future<String?> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final l10n = ref.read(appLocalizationsProvider);
    try {
      final firebaseUser = FirebaseAuth.instance.currentUser;
      if (firebaseUser == null) return l10n.authErrorNotAuthenticated;

      // Re-authenticate before changing password
      final credential = EmailAuthProvider.credential(
        email: firebaseUser.email ?? '',
        password: currentPassword,
      );
      await firebaseUser.reauthenticateWithCredential(credential);
      await firebaseUser.updatePassword(newPassword);
      return null;
    } on FirebaseAuthException catch (e) {
      return passwordChangeErrorMessage(l10n, e.code);
    } catch (_) {
      return l10n.passwordErrorGeneric;
    }
  }

  /// Reflects a language the user just chose (and saved) in the loaded
  /// profile, so a later profile refresh does not read back the old one.
  void applyLanguage(String language) {
    final current = state.asData?.value;
    if (current != null && current.language != language) {
      state = AsyncData(current.copyWith(language: language));
    }
  }
}
