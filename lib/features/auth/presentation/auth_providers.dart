import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/datasources/auth_remote_data_source.dart';
import '../data/datasources/firebase_auth_remote_data_source.dart';
import '../data/datasources/firestore_user_profile_remote_data_source.dart';
import '../data/datasources/user_profile_remote_data_source.dart';
import '../data/repositories/auth_repository_impl.dart';
import '../data/repositories/user_profile_repository_impl.dart';
import '../domain/repositories/auth_repository.dart';
import '../domain/repositories/user_profile_repository.dart';

final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>((ref) {
  return FirebaseAuthRemoteDataSource();
});

final userProfileRemoteDataSourceProvider =
    Provider<UserProfileRemoteDataSource>((ref) {
      return FirestoreUserProfileRemoteDataSource();
    });

final userProfileRepositoryProvider = Provider<UserProfileRepository>((ref) {
  return UserProfileRepositoryImpl(
    ref.watch(userProfileRemoteDataSourceProvider),
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(
    ref.watch(authRemoteDataSourceProvider),
    ref.watch(userProfileRepositoryProvider),
  );
});
