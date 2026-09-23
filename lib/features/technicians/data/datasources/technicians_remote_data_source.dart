import '../../domain/entities/technician.dart';

abstract interface class TechniciansRemoteDataSource {
  Stream<List<Technician>> watchCompanyTechnicians(String companyId);

  /// Watches the technician record that belongs to the signed-in technician
  /// user, matched by their company and email. Used as a fallback for
  /// technician records created before self-registration existed (their
  /// document id is not the technician's Firebase Auth uid).
  Stream<Technician?> watchSelfTechnician({
    required String companyId,
    required String email,
  });

  /// Watches the technician record keyed by the signed-in technician's own
  /// Firebase Auth uid, the scheme used by every technician account a
  /// company admin creates.
  Stream<Technician?> watchTechnicianByUid(String uid);

  Future<void> updateTechnician(Technician technician);

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
