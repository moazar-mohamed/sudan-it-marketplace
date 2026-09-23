import '../entities/technician.dart';

abstract interface class TechniciansRepository {
  Stream<List<Technician>> watchCompanyTechnicians(String companyId);

  /// Watches the technician record that belongs to the signed-in technician
  /// user, matched by their company and email. Fallback for technicians
  /// created before self-registration existed.
  Stream<Technician?> watchSelfTechnician({
    required String companyId,
    required String email,
  });

  /// Watches the technician record keyed by the signed-in technician's own
  /// Firebase Auth uid.
  Stream<Technician?> watchTechnicianByUid(String uid);

  Future<void> updateTechnician(Technician technician);

  /// Soft-delete: marks the technician inactive rather than removing the
  /// record, matching this app's existing delete-by-deactivation pattern.
  Future<void> deactivateTechnician(String technicianId);

  /// Creates the technician's Firebase Auth account with [password] (a
  /// temporary one) together with their `users/{uid}` profile
  /// (`mustChangePassword: true`) and `technicians/{uid}` record, so the
  /// technician must choose their own password at first sign-in. [companyId]
  /// must be the caller's own trusted company id.
  ///
  /// Throws [AppException] with `technicianEmailInUse` when the email already
  /// has an account.
  Future<void> provisionTechnician({
    required String companyId,
    required String fullName,
    required String phone,
    required String email,
    required String password,
  });
}
