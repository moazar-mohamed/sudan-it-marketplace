import '../../orders/domain/entities/order_entity.dart';
import '../domain/entities/app_notification.dart';

/// Builds the [AppNotification] payload for each app event. Centralizing
/// this keeps the wording (including the required Arabic completion
/// message) in one place instead of duplicated at each call site.
class NotificationEvents {
  NotificationEvents._();

  static AppNotification newOrder({
    required String id,
    required String orderId,
    required String companyId,
    required String productName,
  }) {
    return AppNotification(
      id: id,
      recipientType: NotificationRecipientType.companyAdmin,
      recipientId: companyId,
      orderId: orderId,
      type: 'new_order',
      title: 'New order received',
      body: 'A new order for "$productName" was placed and is awaiting payment verification.',
      createdAt: DateTime.now(),
    );
  }

  static AppNotification paymentConfirmed({
    required String id,
    required String orderId,
    required String customerId,
    required String productName,
  }) {
    return AppNotification(
      id: id,
      recipientType: NotificationRecipientType.customer,
      recipientId: customerId,
      orderId: orderId,
      type: 'payment_confirmed',
      title: 'Payment confirmed',
      body: 'Your payment for "$productName" has been confirmed.',
      createdAt: DateTime.now(),
    );
  }

  static AppNotification orderOutForDelivery({
    required String id,
    required String orderId,
    required String customerId,
    required String productName,
  }) {
    return AppNotification(
      id: id,
      recipientType: NotificationRecipientType.customer,
      recipientId: customerId,
      orderId: orderId,
      type: 'out_for_delivery',
      title: 'Order out for delivery',
      body: 'Your order "$productName" is out for delivery.',
      createdAt: DateTime.now(),
    );
  }

  static AppNotification orderCompleted({
    required String id,
    required String orderId,
    required String customerId,
    required String productName,
  }) {
    return AppNotification(
      id: id,
      recipientType: NotificationRecipientType.customer,
      recipientId: customerId,
      orderId: orderId,
      type: 'order_completed',
      title: 'Order completed',
      body: 'تم إكمال طلبك',
      createdAt: DateTime.now(),
    );
  }

  /// The customer-facing notification for a job/order status change, or
  /// null when the new status (Processing) doesn't warrant one.
  static AppNotification? forOrderStatusChange({
    required String id,
    required OrderStatus status,
    required String orderId,
    required String customerId,
    required String productName,
  }) {
    return switch (status) {
      OrderStatus.outForDelivery => orderOutForDelivery(
          id: id,
          orderId: orderId,
          customerId: customerId,
          productName: productName,
        ),
      OrderStatus.completed => orderCompleted(
          id: id,
          orderId: orderId,
          customerId: customerId,
          productName: productName,
        ),
      OrderStatus.processing => null,
    };
  }

  static AppNotification technicianAssigned({
    required String id,
    required String orderId,
    required String technicianId,
    required String productName,
  }) {
    return AppNotification(
      id: id,
      recipientType: NotificationRecipientType.technician,
      recipientId: technicianId,
      orderId: orderId,
      type: 'technician_assigned',
      title: 'New installation job assigned',
      body: 'You have been assigned to install "$productName".',
      createdAt: DateTime.now(),
    );
  }

  /// To the company: a customer rated an order. Only orders notify; the
  /// notification rules are keyed on orders.
  static AppNotification newReview({
    required String id,
    required String orderId,
    required String companyId,
    required String productName,
    required int stars,
  }) {
    return AppNotification(
      id: id,
      recipientType: NotificationRecipientType.companyAdmin,
      recipientId: companyId,
      orderId: orderId,
      type: 'new_review',
      title: 'New rating',
      body: 'A customer rated "$productName" $stars/5.',
      createdAt: DateTime.now(),
    );
  }

  /// To the customer: the company replied to their rating of an order.
  static AppNotification reviewReply({
    required String id,
    required String orderId,
    required String customerId,
    required String productName,
  }) {
    return AppNotification(
      id: id,
      recipientType: NotificationRecipientType.customer,
      recipientId: customerId,
      orderId: orderId,
      type: 'review_reply',
      title: 'The company replied',
      body: 'The company replied to your rating of "$productName".',
      createdAt: DateTime.now(),
    );
  }
}
