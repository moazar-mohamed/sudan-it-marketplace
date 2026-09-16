import 'user_role.dart';

class UserProfile {
  const UserProfile({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    required this.createdAt,
    required this.isActive,
    this.phone,
    this.companyId,
  });

  final String id;
  final String fullName;
  final String email;
  final UserRole role;
  final DateTime createdAt;
  final bool isActive;
  final String? phone;

  /// Set only for company_admin and technician users; links the user to
  /// their company.
  final String? companyId;

  UserProfile copyWith({
    String? id,
    String? fullName,
    String? email,
    UserRole? role,
    DateTime? createdAt,
    bool? isActive,
    String? phone,
    String? companyId,
  }) {
    return UserProfile(
      id: id ?? this.id,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      role: role ?? this.role,
      createdAt: createdAt ?? this.createdAt,
      isActive: isActive ?? this.isActive,
      phone: phone ?? this.phone,
      companyId: companyId ?? this.companyId,
    );
  }
}
