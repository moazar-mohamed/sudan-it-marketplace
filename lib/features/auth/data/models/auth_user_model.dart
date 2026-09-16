import 'package:firebase_auth/firebase_auth.dart';

import '../../domain/entities/auth_user.dart';

class AuthUserModel extends AuthUser {
  const AuthUserModel({
    required super.id,
    super.email,
  });

  factory AuthUserModel.fromUidAndEmail({
    required String id,
    String? email,
  }) {
    return AuthUserModel(id: id, email: email);
  }

  factory AuthUserModel.fromFirebaseUser(User user) {
    return AuthUserModel(
      id: user.uid,
      email: user.email,
    );
  }

  AuthUser toEntity() => AuthUser(id: id, email: email);
}
