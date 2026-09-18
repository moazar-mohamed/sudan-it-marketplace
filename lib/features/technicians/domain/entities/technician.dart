class Technician {
  const Technician({
    required this.id,
    required this.companyId,
    required this.fullName,
    this.phone = '',
    this.email,
    this.uid,
    this.isActive = true,
    this.createdAt,
  });

  final String id;
  final String companyId;
  final String fullName;
  final String phone;
  final String? email;

  /// The technician's Firebase Auth UID, set when the account was
  /// provisioned through the secure backend (createTechnician callable).
  final String? uid;
  final bool isActive;
  final DateTime? createdAt;
}
