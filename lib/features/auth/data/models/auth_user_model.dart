import 'package:firebase_auth/firebase_auth.dart';

import '../../domain/entities/auth_user.dart';

class AuthUserModel extends AuthUser {
  const AuthUserModel({
    required super.id,
    super.email,
    super.emailVerified,
  });

  factory AuthUserModel.fromUidAndEmail({
    required String id,
    String? email,
    bool emailVerified = false,
  }) {
    return AuthUserModel(
      id: id,
      email: email,
      emailVerified: emailVerified,
    );
  }

  factory AuthUserModel.fromFirebaseUser(User user) {
    return AuthUserModel(
      id: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
    );
  }

  AuthUser toEntity() =>
      AuthUser(id: id, email: email, emailVerified: emailVerified);
}
