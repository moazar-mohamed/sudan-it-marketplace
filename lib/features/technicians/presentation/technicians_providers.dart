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
