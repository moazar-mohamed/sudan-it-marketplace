import '../../domain/entities/app_notification.dart';

abstract interface class NotificationsRemoteDataSource {
  Stream<List<AppNotification>> watchCustomerNotifications(String customerId);

  Stream<List<AppNotification>> watchCompanyNotifications(String companyId);

  Stream<List<AppNotification>> watchTechnicianNotifications(
    String technicianId,
  );

  String newNotificationId();

  /// True once it is stored; false when it could not be (never throws).
  Future<bool> createNotification(AppNotification notification);

  Future<void> markAsRead(String notificationId);
}
