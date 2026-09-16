import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/datasources/firestore_notifications_remote_data_source.dart';
import '../data/datasources/notifications_remote_data_source.dart';
import '../data/repositories/notifications_repository_impl.dart';
import '../domain/entities/app_notification.dart';
import '../domain/repositories/notifications_repository.dart';

final notificationsRemoteDataSourceProvider =
    Provider<NotificationsRemoteDataSource>((ref) {
  return FirestoreNotificationsRemoteDataSource();
});

final notificationsRepositoryProvider = Provider<NotificationsRepository>((
  ref,
) {
  return NotificationsRepositoryImpl(
    ref.watch(notificationsRemoteDataSourceProvider),
  );
});

final customerNotificationsStreamProvider =
    StreamProvider.family<List<AppNotification>, String>((ref, customerId) {
  if (customerId.isEmpty) {
    return Stream.value(const []);
  }
  return ref
      .watch(notificationsRepositoryProvider)
      .watchCustomerNotifications(customerId);
});

final companyNotificationsStreamProvider =
    StreamProvider.family<List<AppNotification>, String>((ref, companyId) {
  if (companyId.isEmpty) {
    return Stream.value(const []);
  }
  return ref
      .watch(notificationsRepositoryProvider)
      .watchCompanyNotifications(companyId);
});

final technicianNotificationsStreamProvider =
    StreamProvider.family<List<AppNotification>, String>((ref, technicianId) {
  if (technicianId.isEmpty) {
    return Stream.value(const []);
  }
  return ref
      .watch(notificationsRepositoryProvider)
      .watchTechnicianNotifications(technicianId);
});
