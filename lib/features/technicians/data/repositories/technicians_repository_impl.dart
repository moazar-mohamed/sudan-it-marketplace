import '../../domain/entities/technician.dart';
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
  Future<void> updateTechnician(Technician technician) =>
      _remoteDataSource.updateTechnician(technician);

  @override
  Future<void> deactivateTechnician(String technicianId) =>
      _remoteDataSource.deactivateTechnician(technicianId);

  @override
  Future<void> provisionTechnician({
    required String companyId,
    required String fullName,
    required String phone,
    required String email,
    required String password,
  }) =>
      _remoteDataSource.provisionTechnician(
        companyId: companyId,
        fullName: fullName,
        phone: phone,
        email: email,
        password: password,
      );
}
