class Technician {
  const Technician({
    required this.id,
    required this.companyId,
    required this.fullName,
    this.phone = '',
    this.email,
    this.isActive = true,
    this.createdAt,
  });

  final String id;
  final String companyId;
  final String fullName;
  final String phone;
  final String? email;
  final bool isActive;
  final DateTime? createdAt;
}
