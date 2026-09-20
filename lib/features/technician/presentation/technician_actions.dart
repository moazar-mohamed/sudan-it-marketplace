import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/error_messages.dart';
import '../../../core/localization/locale_controller.dart';
import '../../notifications/presentation/notification_events.dart';
import '../../notifications/presentation/notifications_providers.dart';
import '../../orders/domain/entities/order_entity.dart';
import '../../orders/presentation/orders_providers.dart';

final technicianActionsProvider = Provider<TechnicianActions>((ref) {
  return TechnicianActions(ref);
});

/// Write operations used by the Technician screens. Each method returns
/// null on success or a user-facing error message.
class TechnicianActions {
  TechnicianActions(this._ref);

  final Ref _ref;

  Future<String?> advanceJobStatus(OrderEntity order, OrderStatus status) {
    return _guard(() async {
      await _ref.read(ordersRepositoryProvider).updateOrderStatus(
            orderId: order.id,
            orderStatus: status,
          );
      final notifications = _ref.read(notificationsRepositoryProvider);
      final event = NotificationEvents.forOrderStatusChange(
        id: notifications.newNotificationId(),
        status: status,
        orderId: order.id,
        customerId: order.customerId,
        productName: order.productName,
      );
      if (event != null) {
        await notifications.createNotification(event);
      }
    });
  }

  Future<String?> _guard(Future<void> Function() action) async {
    try {
      await action();
      return null;
    } catch (error) {
      return localizedErrorMessage(_ref.read(appLocalizationsProvider), error);
    }
  }
}
