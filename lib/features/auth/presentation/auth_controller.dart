import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/auth_user.dart';
import '../domain/exceptions/auth_exception.dart';
import '../domain/repositories/auth_repository.dart';
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
      state = AuthError(error.message);
    } catch (_) {
      state = const AuthError('Authentication failed. Please try again.');
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
      state = AuthError(error.message);
    } catch (error, st) {
      // ignore: avoid_print
      print('[DIAG][AuthController.signUpWithEmail] type=${error.runtimeType} error=$error\n$st');
      state = const AuthError('Authentication failed. Please try again.');
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
      state = AuthError(error.message);
    } catch (_) {
      state = const AuthError('Authentication failed. Please try again.');
    }
  }

  Future<void> signOut() async {
    state = const AuthLoading();
    try {
      await _repository.signOut();
      state = const AuthUnauthenticated();
    } on AuthException catch (error) {
      state = AuthError(error.message);
    } catch (_) {
      state = const AuthError('Authentication failed. Please try again.');
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
      state = AuthError(error.message);
      return;
    }
    state = const AuthError('Authentication failed. Please try again.');
  }
}
