import '../../orders/domain/entities/order_entity.dart';
import '../domain/entities/app_notification.dart';

/// The type of each notification the app sends. Keep in step with the
/// security rules (which allow exactly these, each only from its own kind of
/// sender), NotificationFormat and the push relay's texts.
abstract final class NotificationTypes {
  static const newOrder = 'new_order';
  static const paymentConfirmed = 'payment_confirmed';
  static const outForDelivery = 'out_for_delivery';
  static const orderCompleted = 'order_completed';
  static const technicianAssigned = 'technician_assigned';
  static const newReview = 'new_review';
  static const reviewReply = 'review_reply';

  static const all = {
    newOrder,
    paymentConfirmed,
    outForDelivery,
    orderCompleted,
    technicianAssigned,
    newReview,
    reviewReply,
  };
}

/// Builds the [AppNotification] for each app event: its type, who it goes
/// to and the order's product name. There is no wording here; the words are
/// built where it is shown (NotificationFormat, the push relay).
class NotificationEvents {
  NotificationEvents._();

  static AppNotification _build({
    required NotificationRecipientType recipientType,
    required String recipientId,
    required String orderId,
    required String type,
    required String productName,
  }) {
    return AppNotification(
      id: AppNotification.idFor(
        orderId: orderId,
        type: type,
        recipientType: recipientType,
        recipientId: recipientId,
      ),
      recipientType: recipientType,
      recipientId: recipientId,
      orderId: orderId,
      type: type,
      productName: productName,
      createdAt: DateTime.now(),
    );
  }

  static AppNotification newOrder({
    required String orderId,
    required String companyId,
    required String productName,
  }) =>
      _build(
        recipientType: NotificationRecipientType.companyAdmin,
        recipientId: companyId,
        orderId: orderId,
        type: NotificationTypes.newOrder,
        productName: productName,
      );

  static AppNotification paymentConfirmed({
    required String orderId,
    required String customerId,
    required String productName,
  }) =>
      _build(
        recipientType: NotificationRecipientType.customer,
        recipientId: customerId,
        orderId: orderId,
        type: NotificationTypes.paymentConfirmed,
        productName: productName,
      );

  static AppNotification orderOutForDelivery({
    required String orderId,
    required String customerId,
    required String productName,
  }) =>
      _build(
        recipientType: NotificationRecipientType.customer,
        recipientId: customerId,
        orderId: orderId,
        type: NotificationTypes.outForDelivery,
        productName: productName,
      );

  static AppNotification orderCompleted({
    required String orderId,
    required String customerId,
    required String productName,
  }) =>
      _build(
        recipientType: NotificationRecipientType.customer,
        recipientId: customerId,
        orderId: orderId,
        type: NotificationTypes.orderCompleted,
        productName: productName,
      );

  /// The customer-facing notification for a job/order status change, or
  /// null when the new status (Processing) doesn't warrant one.
  static AppNotification? forOrderStatusChange({
    required OrderStatus status,
    required String orderId,
    required String customerId,
    required String productName,
  }) {
    return switch (status) {
      OrderStatus.outForDelivery => orderOutForDelivery(
          orderId: orderId,
          customerId: customerId,
          productName: productName,
        ),
      OrderStatus.completed => orderCompleted(
          orderId: orderId,
          customerId: customerId,
          productName: productName,
        ),
      // No status-change notification for these (a cancellation is not a
      // status step; see CompanyAdminActions.cancelOrder).
      OrderStatus.processing || OrderStatus.cancelled => null,
    };
  }

  static AppNotification technicianAssigned({
    required String orderId,
    required String technicianId,
    required String productName,
  }) =>
      _build(
        recipientType: NotificationRecipientType.technician,
        recipientId: technicianId,
        orderId: orderId,
        type: NotificationTypes.technicianAssigned,
        productName: productName,
      );

  /// To the company: a customer rated an order. Only orders notify; the
  /// notification rules are keyed on orders.
  static AppNotification newReview({
    required String orderId,
    required String companyId,
    required String productName,
  }) =>
      _build(
        recipientType: NotificationRecipientType.companyAdmin,
        recipientId: companyId,
        orderId: orderId,
        type: NotificationTypes.newReview,
        productName: productName,
      );

  /// To the customer: the company replied to their rating of an order.
  static AppNotification reviewReply({
    required String orderId,
    required String customerId,
    required String productName,
  }) =>
      _build(
        recipientType: NotificationRecipientType.customer,
        recipientId: customerId,
        orderId: orderId,
        type: NotificationTypes.reviewReply,
        productName: productName,
      );
}
