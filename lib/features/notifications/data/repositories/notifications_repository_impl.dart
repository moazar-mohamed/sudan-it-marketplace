import 'dart:async';

import '../../../../core/push/push_relay.dart';
import '../../domain/entities/app_notification.dart';
import '../../domain/repositories/notifications_repository.dart';
import '../datasources/notifications_remote_data_source.dart';

class NotificationsRepositoryImpl implements NotificationsRepository {
  const NotificationsRepositoryImpl(
    this._remoteDataSource, [
    this._pushRelay = const NoPushRelay(),
  ]);

  final NotificationsRemoteDataSource _remoteDataSource;
  final PushRelay _pushRelay;

  @override
  Stream<List<AppNotification>> watchCustomerNotifications(
    String customerId,
  ) =>
      _remoteDataSource.watchCustomerNotifications(customerId);

  @override
  Stream<List<AppNotification>> watchCompanyNotifications(String companyId) =>
      _remoteDataSource.watchCompanyNotifications(companyId);

  @override
  Stream<List<AppNotification>> watchTechnicianNotifications(
    String technicianId,
  ) =>
      _remoteDataSource.watchTechnicianNotifications(technicianId);

  /// Once it is stored, it also goes to the recipients' phones (in the
  /// background: the caller never waits for the push).
  @override
  Future<void> createNotification(AppNotification notification) async {
    if (await _remoteDataSource.createNotification(notification)) {
      unawaited(_pushRelay.notification(notification.id));
    }
  }

  @override
  Future<void> markAsRead(String notificationId) =>
      _remoteDataSource.markAsRead(notificationId);

  @override
  Future<void> deleteNotification(String notificationId) =>
      _remoteDataSource.deleteNotification(notificationId);
}
