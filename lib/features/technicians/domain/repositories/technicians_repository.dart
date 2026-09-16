import '../entities/technician.dart';

abstract interface class TechniciansRepository {
  Stream<List<Technician>> watchCompanyTechnicians(String companyId);

  String newTechnicianId();

  Future<void> createTechnician(Technician technician);

  Future<void> updateTechnician(Technician technician);

  /// Soft-delete: marks the technician inactive rather than removing the
  /// record, matching this app's existing delete-by-deactivation pattern.
  Future<void> deactivateTechnician(String technicianId);
}
