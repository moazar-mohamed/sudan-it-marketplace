import '../../domain/entities/technician.dart';

abstract interface class TechniciansRemoteDataSource {
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

  Future<void> deactivateTechnician(String technicianId);
}
