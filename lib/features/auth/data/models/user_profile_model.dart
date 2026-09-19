import '../../domain/entities/user_profile.dart';
import '../../domain/entities/user_role.dart';

class UserProfileModel extends UserProfile {
  const UserProfileModel({
    required super.id,
    required super.fullName,
    required super.email,
    required super.role,
    required super.createdAt,
    required super.isActive,
    super.phone,
    super.companyId,
    super.photoUrl,
    super.mustChangePassword,
  });

  factory UserProfileModel.customer({
    required String id,
    required String fullName,
    required String email,
    String? phone,
  }) {
    return UserProfileModel(
      id: id,
      fullName: fullName,
      email: email,
      phone: phone,
      role: UserRole.customer,
      createdAt: DateTime.now().toUtc(),
      isActive: true,
    );
  }

  factory UserProfileModel.fromFirestoreMap(
    Map<String, dynamic> map,
    String id,
  ) {
    DateTime createdAt;
    final rawCreatedAt = map['createdAt'];
    if (rawCreatedAt is DateTime) {
      createdAt = rawCreatedAt;
    } else {
      try {
        // Firestore Timestamp has .toDate()
        createdAt = (rawCreatedAt as dynamic).toDate() as DateTime;
      } catch (_) {
        createdAt = DateTime.now().toUtc();
      }
    }

    String? text(String key) {
      final value = map[key];
      if (value == null) {
        return null;
      }
      final result = value.toString().trim();
      return result.isEmpty ? null : result;
    }

    UserRole role;
    try {
      role = UserRole.fromFirestoreValue(
        (text('role') ?? 'customer').toLowerCase(),
      );
    } catch (_) {
      role = UserRole.customer;
    }

    final rawIsActive = map['isActive'];

    return UserProfileModel(
      id: id,
      fullName: text('fullName') ?? text('name') ?? '',
      email: text('email') ?? '',
      role: role,
      createdAt: createdAt,
      isActive: rawIsActive is bool ? rawIsActive : true,
      phone: text('phone') ?? text('phoneNumber'),
      companyId: text('companyId'),
      photoUrl: text('photoUrl'),
      // Only a real `true` counts; a missing or malformed value never locks anyone.
      mustChangePassword: map['mustChangePassword'] == true,
    );
  }

  Map<String, dynamic> toFirestoreMap() {
    return {
      'id': id,
      'fullName': fullName,
      'email': email,
      'role': role.firestoreValue,
      'isActive': isActive,
      if (phone != null) 'phone': phone,
      if (photoUrl != null) 'photoUrl': photoUrl,
    };
  }
}
