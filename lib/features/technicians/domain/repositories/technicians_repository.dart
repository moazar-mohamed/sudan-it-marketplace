import '../entities/technician.dart';
import '../entities/technician_invite.dart';

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

  String newTechnicianId();

  Future<void> createTechnician(Technician technician);

  Future<void> updateTechnician(Technician technician);

  /// Soft-delete: marks the technician inactive rather than removing the
  /// record, matching this app's existing delete-by-deactivation pattern.
  Future<void> deactivateTechnician(String technicianId);

  /// Watches the pending technician invitations for a company.
  Stream<List<TechnicianInvite>> watchPendingInvites(String companyId);

  /// Creates a pending technician invitation under the caller's own
  /// (trusted) companyId. The technician claims it themself at
  /// registration; no Firebase Auth account is created here.
  Future<void> createInvite({
    required String companyId,
    required String fullName,
    required String phone,
    required String email,
  });

  /// Looks up a pending invitation for [email], or null if none exists.
  Future<TechnicianInvite?> fetchPendingInvite(String email);

  /// Atomically claims [invite] for the newly-registered technician [uid].
  Future<void> claimInvite({
    required String uid,
    required TechnicianInvite invite,
  });
}
