import '../domain/entities/auth_user.dart';

sealed class AuthState {
  const AuthState();
}

final class AuthLoading extends AuthState {
  const AuthLoading();
}

final class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user);

  final AuthUser user;
}

final class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

final class AuthError extends AuthState {
  const AuthError(this.message, {this.code});

  /// English text for logs. The UI shows the translation of [code] instead
  /// (see authErrorMessage), so the message follows a language change.
  final String message;
  final String? code;
}
