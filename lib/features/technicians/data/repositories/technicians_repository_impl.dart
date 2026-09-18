import '../../domain/entities/technician.dart';
import '../../domain/entities/technician_invite.dart';
import '../../domain/repositories/technicians_repository.dart';
import '../datasources/technicians_remote_data_source.dart';

class TechniciansRepositoryImpl implements TechniciansRepository {
  const TechniciansRepositoryImpl(this._remoteDataSource);

  final TechniciansRemoteDataSource _remoteDataSource;

  @override
  Stream<List<Technician>> watchCompanyTechnicians(String companyId) =>
      _remoteDataSource.watchCompanyTechnicians(companyId);

  @override
  Stream<Technician?> watchSelfTechnician({
    required String companyId,
    required String email,
  }) =>
      _remoteDataSource.watchSelfTechnician(companyId: companyId, email: email);

  @override
  Stream<Technician?> watchTechnicianByUid(String uid) =>
      _remoteDataSource.watchTechnicianByUid(uid);

  @override
  String newTechnicianId() => _remoteDataSource.newTechnicianId();

  @override
  Future<void> createTechnician(Technician technician) =>
      _remoteDataSource.createTechnician(technician);

  @override
  Future<void> updateTechnician(Technician technician) =>
      _remoteDataSource.updateTechnician(technician);

  @override
  Future<void> deactivateTechnician(String technicianId) =>
      _remoteDataSource.deactivateTechnician(technicianId);

  @override
  Stream<List<TechnicianInvite>> watchPendingInvites(String companyId) =>
      _remoteDataSource.watchPendingInvites(companyId);

  @override
  Future<void> createInvite({
    required String companyId,
    required String fullName,
    required String phone,
    required String email,
  }) =>
      _remoteDataSource.createInvite(
        companyId: companyId,
        fullName: fullName,
        phone: phone,
        email: email,
      );

  @override
  Future<TechnicianInvite?> fetchPendingInvite(String email) =>
      _remoteDataSource.fetchPendingInvite(email);

  @override
  Future<void> claimInvite({
    required String uid,
    required TechnicianInvite invite,
  }) =>
      _remoteDataSource.claimInvite(uid: uid, invite: invite);
}
