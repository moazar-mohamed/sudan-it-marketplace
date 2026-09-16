import '../../domain/entities/company_service.dart';

class CompanyServiceModel extends CompanyService {
  const CompanyServiceModel({
    required super.id,
    required super.companyId,
    required super.serviceId,
    required super.isActive,
    required super.createdAt,
  });

  factory CompanyServiceModel.fromMap(String id, Map<String, dynamic> data) {
    return CompanyServiceModel(
      id: id,
      companyId: data['companyId'] as String? ?? '',
      serviceId: data['serviceId'] as String? ?? '',
      isActive: data['isActive'] as bool? ?? false,
      createdAt: data['createdAt'] is DateTime
          ? (data['createdAt'] as DateTime).toUtc()
          : DateTime.now().toUtc(),
    );
  }

  Map<String, dynamic> toFirestoreMap() {
    return {
      'id': id,
      'companyId': companyId,
      'serviceId': serviceId,
      'isActive': isActive,
    };
  }
}
