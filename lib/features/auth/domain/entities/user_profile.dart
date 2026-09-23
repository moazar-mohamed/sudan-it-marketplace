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
    this.photoUrl,
    this.mustChangePassword = false,
    this.createdByCompany = false,
    this.language,
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

  /// Profile picture URL (customers). Absent when no picture was set.
  final String? photoUrl;

  /// True while a company admin is still on the temporary password the
  /// Platform Admin set when creating the company. Absent (false) on every
  /// account that predates the flag. The password itself is never stored here.
  final bool mustChangePassword;

  /// True when the account was created for the user by their company (a
  /// technician the company admin added), which is the only way the profile
  /// gets a `mustChangePassword` field at all: it stays there, `false`, after
  /// the password has been changed. The company vouches for the email, so no
  /// mailbox check is asked of these accounts. A user cannot give themself the
  /// field (see firestore.rules), so a self-registered technician never has it.
  final bool createdByCompany;

  /// The language the user chose ('en' or 'ar'). Absent on every account that
  /// predates the setting; the app then falls back to the device preference.
  final String? language;

  /// A company admin or technician on a temporary password must choose their
  /// own before using the app.
  bool get requiresPasswordChange =>
      (role == UserRole.companyAdmin || role == UserRole.technician) &&
      mustChangePassword;

  UserProfile copyWith({
    String? id,
    String? fullName,
    String? email,
    UserRole? role,
    DateTime? createdAt,
    bool? isActive,
    String? phone,
    String? companyId,
    String? photoUrl,
    bool? mustChangePassword,
    bool? createdByCompany,
    String? language,
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
      photoUrl: photoUrl ?? this.photoUrl,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      createdByCompany: createdByCompany ?? this.createdByCompany,
      language: language ?? this.language,
    );
  }
}
