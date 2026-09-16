import '../entities/technician.dart';

abstract interface class TechniciansRepository {
  Stream<List<Technician>> watchCompanyTechnicians(String companyId);

  /// Watches the technician record that belongs to the signed-in technician
  /// user, matched by their company and email.
  Stream<Technician?> watchSelfTechnician({
    required String companyId,
    required String email,
  });

  String newTechnicianId();

  Future<void> createTechnician(Technician technician);

  Future<void> updateTechnician(Technician technician);

  /// Soft-delete: marks the technician inactive rather than removing the
  /// record, matching this app's existing delete-by-deactivation pattern.
  Future<void> deactivateTechnician(String technicianId);
}
