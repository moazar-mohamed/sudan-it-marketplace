import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/datasources/firestore_technicians_remote_data_source.dart';
import '../data/datasources/technicians_remote_data_source.dart';
import '../data/repositories/technicians_repository_impl.dart';
import '../domain/entities/technician.dart';
import '../domain/repositories/technicians_repository.dart';

final techniciansRemoteDataSourceProvider =
    Provider<TechniciansRemoteDataSource>((ref) {
  return FirestoreTechniciansRemoteDataSource();
});

final techniciansRepositoryProvider = Provider<TechniciansRepository>((ref) {
  return TechniciansRepositoryImpl(ref.watch(techniciansRemoteDataSourceProvider));
});

final companyTechniciansStreamProvider =
    StreamProvider.family<List<Technician>, String>((ref, companyId) {
  if (companyId.isEmpty) {
    return Stream.value(const []);
  }
  return ref
      .watch(techniciansRepositoryProvider)
      .watchCompanyTechnicians(companyId);
});

/// Looks up the technician record for the signed-in technician user, matched
/// by their company and email. Fallback for technicians created before
/// self-registration existed (their doc id is not their Firebase Auth uid).
final technicianSelfProvider = StreamProvider.family<Technician?,
    ({String companyId, String email})>((ref, args) {
  if (args.companyId.isEmpty || args.email.isEmpty) {
    return Stream.value(null);
  }
  return ref.watch(techniciansRepositoryProvider).watchSelfTechnician(
        companyId: args.companyId,
        email: args.email,
      );
});

/// Looks up the technician record keyed by the signed-in technician's own
/// Firebase Auth uid; every technician account a company admin creates uses
/// this scheme.
final technicianByUidProvider =
    StreamProvider.family<Technician?, String>((ref, uid) {
  if (uid.isEmpty) {
    return Stream.value(null);
  }
  return ref.watch(techniciansRepositoryProvider).watchTechnicianByUid(uid);
});
