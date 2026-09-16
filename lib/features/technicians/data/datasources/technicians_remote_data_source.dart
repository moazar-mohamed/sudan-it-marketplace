import '../../domain/entities/technician.dart';

abstract interface class TechniciansRemoteDataSource {
  Stream<List<Technician>> watchCompanyTechnicians(String companyId);

  String newTechnicianId();

  Future<void> createTechnician(Technician technician);

  Future<void> updateTechnician(Technician technician);

  Future<void> deactivateTechnician(String technicianId);
}
