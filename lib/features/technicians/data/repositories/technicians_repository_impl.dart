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
}
