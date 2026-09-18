class AuthUser {
  const AuthUser({
    required this.id,
    this.email,
    this.emailVerified = false,
  });

  final String id;
  final String? email;

  /// Firebase's verification state for [email]. Google (and other trusted
  /// OAuth providers) come back already verified, so only email/password
  /// accounts have to go through the verification step.
  final bool emailVerified;
}
