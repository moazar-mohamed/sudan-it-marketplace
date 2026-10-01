import '../../orders/domain/entities/order_entity.dart';
import '../../service_requests/domain/entities/service_request.dart';
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
  static const newServiceRequest = 'new_service_request';
  static const serviceRequestAccepted = 'service_request_accepted';
  static const serviceRequestRejected = 'service_request_rejected';
  static const serviceRequestInProgress = 'service_request_in_progress';
  static const serviceRequestCompleted = 'service_request_completed';
  static const serviceRequestCancelled = 'service_request_cancelled';

  static const all = {
    newOrder,
    paymentConfirmed,
    outForDelivery,
    orderCompleted,
    technicianAssigned,
    newReview,
    reviewReply,
    newServiceRequest,
    serviceRequestAccepted,
    serviceRequestRejected,
    serviceRequestInProgress,
    serviceRequestCompleted,
    serviceRequestCancelled,
  };
}

/// Builds the [AppNotification] for each app event: its type, who it goes
/// to and the order's product name (or the request's service name). There is no wording here; the words are
/// built where it is shown (NotificationFormat, the push relay).
class NotificationEvents {
  NotificationEvents._();

  /// About an order ([orderId]) or a service request ([serviceRequestId]).
  static AppNotification _build({
    required NotificationRecipientType recipientType,
    required String recipientId,
    String orderId = '',
    String serviceRequestId = '',
    required String type,
    required String productName,
  }) {
    return AppNotification(
      id: AppNotification.idFor(
        orderId: orderId,
        serviceRequestId: serviceRequestId,
        type: type,
        recipientType: recipientType,
        recipientId: recipientId,
      ),
      recipientType: recipientType,
      recipientId: recipientId,
      orderId: orderId,
      serviceRequestId: serviceRequestId,
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
      OrderStatus.processing => null,
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

  /// To the company: a customer sent a service request.
  static AppNotification newServiceRequest({
    required String serviceRequestId,
    required String companyId,
    required String serviceName,
  }) =>
      _build(
        recipientType: NotificationRecipientType.companyAdmin,
        recipientId: companyId,
        serviceRequestId: serviceRequestId,
        type: NotificationTypes.newServiceRequest,
        productName: serviceName,
      );

  /// The notification for a service request moving to [status]: to the
  /// company when the customer cancelled, to the customer for the company's
  /// answers. Null for a status nobody needs to hear about (Pending).
  static AppNotification? forServiceRequestStatus({
    required ServiceRequestStatus status,
    required String serviceRequestId,
    required String customerId,
    required String companyId,
    required String serviceName,
  }) {
    AppNotification toCustomer(String type) => _build(
          recipientType: NotificationRecipientType.customer,
          recipientId: customerId,
          serviceRequestId: serviceRequestId,
          type: type,
          productName: serviceName,
        );

    return switch (status) {
      ServiceRequestStatus.accepted =>
        toCustomer(NotificationTypes.serviceRequestAccepted),
      ServiceRequestStatus.rejected =>
        toCustomer(NotificationTypes.serviceRequestRejected),
      ServiceRequestStatus.inProgress =>
        toCustomer(NotificationTypes.serviceRequestInProgress),
      ServiceRequestStatus.completed =>
        toCustomer(NotificationTypes.serviceRequestCompleted),
      ServiceRequestStatus.cancelled => _build(
          recipientType: NotificationRecipientType.companyAdmin,
          recipientId: companyId,
          serviceRequestId: serviceRequestId,
          type: NotificationTypes.serviceRequestCancelled,
          productName: serviceName,
        ),
      ServiceRequestStatus.pending => null,
    };
  }
}
