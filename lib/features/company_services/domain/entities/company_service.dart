class CompanyService {
  const CompanyService({
    required this.id,
    required this.companyId,
    required this.serviceId,
    required this.isActive,
    required this.createdAt,
  });

  final String id;
  final String companyId;
  final String serviceId;
  final bool isActive;
  final DateTime createdAt;
}
