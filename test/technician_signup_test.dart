import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:sudan_it_marketplace/features/auth/data/models/auth_user_model.dart';
import 'package:sudan_it_marketplace/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/user_profile_repository.dart';

class _FakeAuthRemote implements AuthRemoteDataSource {
  @override
  Future<AuthUserModel> signUpWithEmail({
    required String email,
    required String password,
  }) async =>
      AuthUserModel(id: 'newUid', email: email);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _RecordingProfiles implements UserProfileRepository {
  final customers = <String>[];

  @override
  Future<void> createCustomerProfile({
    required String id,
    required String fullName,
    required String email,
  }) async {
    customers.add('$id|$fullName|$email');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  // Technicians are created by their company admin only; the retired
  // invite/claim flow can no longer turn a registration into a technician.
  test('registering always creates an ordinary customer profile', () async {
    final profiles = _RecordingProfiles();
    final repository = AuthRepositoryImpl(_FakeAuthRemote(), profiles);

    final user = await repository.signUpWithEmail(
      fullName: '  Tech One ',
      email: 'tech@x.test',
      password: 'secret123',
    );

    expect(user.id, 'newUid');
    expect(profiles.customers, ['newUid|Tech One|tech@x.test']);
  });
}
