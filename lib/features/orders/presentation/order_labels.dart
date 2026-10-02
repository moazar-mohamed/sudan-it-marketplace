import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/entities/order_entity.dart';

/// Translated names for the order enums. The enums keep their English
/// `displayName` (stored/logged values); screens show these instead.
extension OrderStatusLabel on OrderStatus {
  String label(AppLocalizations l10n) => switch (this) {
        OrderStatus.processing => l10n.orderStatusProcessing,
        OrderStatus.outForDelivery => l10n.orderStatusOutForDelivery,
        OrderStatus.completed => l10n.orderStatusCompleted,
        OrderStatus.cancelled => l10n.orderStatusCancelled,
      };

  /// Colour family of the status chip.
  AppTone get tone => switch (this) {
        OrderStatus.processing => AppTone.info,
        OrderStatus.outForDelivery => AppTone.progress,
        OrderStatus.completed => AppTone.success,
        OrderStatus.cancelled => AppTone.error,
      };

  /// The installation job status that follows this order status.
  String jobLabel(AppLocalizations l10n) => switch (this) {
        OrderStatus.processing => l10n.jobStatusPending,
        OrderStatus.outForDelivery => l10n.jobStatusInProgress,
        OrderStatus.completed => l10n.orderStatusCompleted,
        OrderStatus.cancelled => l10n.orderStatusCancelled,
      };
}

extension OrderCancelReasonLabel on OrderCancelReason {
  /// Why the order was cancelled, as shown to the customer and the company.
  String label(AppLocalizations l10n) => switch (this) {
        OrderCancelReason.company => l10n.orderCancelledByCompany,
        OrderCancelReason.expired => l10n.orderCancelledExpired,
        OrderCancelReason.outOfStock => l10n.orderCancelledOutOfStock,
      };
}

extension PaymentStatusLabel on PaymentStatus {
  String label(AppLocalizations l10n) => switch (this) {
        PaymentStatus.pendingVerification => l10n.paymentStatusPending,
        PaymentStatus.confirmed => l10n.paymentStatusConfirmed,
      };

  AppTone get tone => switch (this) {
        PaymentStatus.pendingVerification => AppTone.warning,
        PaymentStatus.confirmed => AppTone.success,
      };
}

extension OrderPaymentLabel on OrderEntity {
  /// A cancelled order's payment was never verified and never will be, so it
  /// is not shown as still waiting for verification.
  bool get _paymentNeverVerified =>
      isCancelled && paymentStatus == PaymentStatus.pendingVerification;

  String paymentLabel(AppLocalizations l10n) => _paymentNeverVerified
      ? l10n.paymentStatusNotVerified
      : paymentStatus.label(l10n);

  AppTone get paymentTone =>
      _paymentNeverVerified ? AppTone.neutral : paymentStatus.tone;
}

extension DeliveryMethodLabel on DeliveryMethod {
  String label(AppLocalizations l10n) => switch (this) {
        DeliveryMethod.delivery => l10n.deliveryMethodDelivery,
        DeliveryMethod.pickup => l10n.deliveryMethodPickup,
      };
}
