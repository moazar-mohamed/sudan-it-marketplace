import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/locale_controller.dart';
import '../domain/entities/auth_user.dart';
import '../domain/exceptions/auth_exception.dart';
import '../domain/repositories/auth_repository.dart';
import 'auth_error_messages.dart';
import 'auth_providers.dart';
import 'auth_state.dart';

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthController extends Notifier<AuthState> {
  AuthRepository get _repository => ref.read(authRepositoryProvider);

  @override
  AuthState build() {
    final repository = ref.watch(authRepositoryProvider);
    final subscription = repository.authStateChanges().listen(
      _applyUser,
      onError: _applyError,
    );
    ref.onDispose(subscription.cancel);
    return const AuthLoading();
  }

  Future<void> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final user = await _repository.signInWithEmail(
        email: email,
        password: password,
      );
      state = AuthAuthenticated(user);
    } on AuthException catch (error) {
      state = AuthError(error.message, code: error.code);
    } catch (_) {
      state = const AuthError('Authentication failed. Please try again.', code: 'unknown');
    }
  }

  Future<void> signUpWithEmail({
    required String fullName,
    required String email,
    required String password,
  }) async {
    try {
      final user = await _repository.signUpWithEmail(
        fullName: fullName,
        email: email,
        password: password,
      );
      state = AuthAuthenticated(user);
    } on AuthException catch (error) {
      state = AuthError(error.message, code: error.code);
    } catch (error, st) {
      // ignore: avoid_print
      print('[DIAG][AuthController.signUpWithEmail] type=${error.runtimeType} error=$error\n$st');
      state = const AuthError('Authentication failed. Please try again.', code: 'unknown');
    }
  }

  Future<void> signInWithGoogle() async {
    try {
      final user = await _repository.signInWithGoogle();
      state = AuthAuthenticated(user);
    } on AuthException catch (error) {
      if (error.code == 'canceled' ||
          error.code == 'popup-closed-by-user' ||
          error.code == 'web-context-canceled') {
        // User dismissed the Google sign-in flow; no error to show.
        return;
      }
      state = AuthError(error.message, code: error.code);
    } catch (_) {
      state = const AuthError('Authentication failed. Please try again.', code: 'unknown');
    }
  }

  /// Re-sends Firebase's verification email to the signed-in user. Returns
  /// null on success, or an error message to show.
  Future<String?> resendVerificationEmail() async {
    try {
      await _repository.sendEmailVerification();
      return null;
    } on AuthException catch (error) {
      return authErrorMessage(ref.read(appLocalizationsProvider), error.code);
    } catch (_) {
      return ref.read(appLocalizationsProvider).authErrorSendVerification;
    }
  }

  /// Reloads the signed-in Firebase user and updates [state] so a freshly
  /// verified email is reflected. Returns whether the email is now verified.
  Future<bool> refreshEmailVerification() async {
    try {
      final user = await _repository.reloadCurrentUser();
      if (user == null) {
        state = const AuthUnauthenticated();
        return false;
      }
      state = AuthAuthenticated(user);
      return user.emailVerified;
    } on AuthException catch (error) {
      state = AuthError(error.message, code: error.code);
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<void> signOut() async {
    state = const AuthLoading();
    try {
      await _repository.signOut();
      state = const AuthUnauthenticated();
    } on AuthException catch (error) {
      state = AuthError(error.message, code: error.code);
    } catch (_) {
      state = const AuthError('Authentication failed. Please try again.', code: 'unknown');
    }
  }

  void _applyUser(AuthUser? user) {
    if (user != null) {
      state = AuthAuthenticated(user);
      return;
    }

    if (state is AuthError) {
      return;
    }

    state = const AuthUnauthenticated();
  }

  void _applyError(Object error) {
    if (error is AuthException) {
      state = AuthError(error.message, code: error.code);
      return;
    }
    state = const AuthError('Authentication failed. Please try again.', code: 'unknown');
  }
}
