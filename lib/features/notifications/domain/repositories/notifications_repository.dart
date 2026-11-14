import '../entities/app_notification.dart';

abstract interface class NotificationsRepository {
  Stream<List<AppNotification>> watchCustomerNotifications(String customerId);

  Stream<List<AppNotification>> watchCompanyNotifications(String companyId);

  Stream<List<AppNotification>> watchTechnicianNotifications(
    String technicianId,
  );

  Future<void> createNotification(AppNotification notification);

  Future<void> markAsRead(String notificationId);

  /// Removes a notification addressed to the signed-in user (the security
  /// rules let only its recipient delete it).
  Future<void> deleteNotification(String notificationId);
}
