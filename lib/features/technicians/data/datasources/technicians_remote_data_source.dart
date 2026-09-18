import '../../domain/entities/technician.dart';
import '../../domain/entities/technician_invite.dart';

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
  /// Firebase Auth uid, the scheme used by every technician created through
  /// the invite/claim flow.
  Stream<Technician?> watchTechnicianByUid(String uid);

  String newTechnicianId();

  Future<void> createTechnician(Technician technician);

  Future<void> updateTechnician(Technician technician);

  Future<void> deactivateTechnician(String technicianId);

  /// Watches the pending technician invitations for a company, so the
  /// Company Admin can see who has been invited but not yet registered.
  Stream<List<TechnicianInvite>> watchPendingInvites(String companyId);

  /// Creates (or resends) a pending technician invitation for
  /// [companyId], which must be the caller's own trusted company id.
  /// Throws if the email already belongs to a claimed invitation.
  Future<void> createInvite({
    required String companyId,
    required String fullName,
    required String phone,
    required String email,
  });

  /// Looks up a pending invitation for [email], or null if none exists.
  Future<TechnicianInvite?> fetchPendingInvite(String email);

  /// Atomically claims [invite] for the newly-registered technician [uid]:
  /// creates `users/{uid}` and `technicians/{uid}` from the invite's
  /// trusted data, and marks the invitation claimed so it cannot be reused.
  Future<void> claimInvite({
    required String uid,
    required TechnicianInvite invite,
  });
}
