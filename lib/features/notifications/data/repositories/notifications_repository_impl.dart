import '../../domain/entities/app_notification.dart';
import '../../domain/repositories/notifications_repository.dart';
import '../datasources/notifications_remote_data_source.dart';

class NotificationsRepositoryImpl implements NotificationsRepository {
  const NotificationsRepositoryImpl(this._remoteDataSource);

  final NotificationsRemoteDataSource _remoteDataSource;

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

  @override
  String newNotificationId() => _remoteDataSource.newNotificationId();

  @override
  Future<void> createNotification(AppNotification notification) =>
      _remoteDataSource.createNotification(notification);

  @override
  Future<void> markAsRead(String notificationId) =>
      _remoteDataSource.markAsRead(notificationId);
}
