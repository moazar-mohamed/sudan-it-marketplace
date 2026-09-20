import '../../../l10n/app_localizations.dart';
import '../domain/entities/order_entity.dart';

/// Translated names for the order enums. The enums keep their English
/// `displayName` (stored/logged values); screens show these instead.
extension OrderStatusLabel on OrderStatus {
  String label(AppLocalizations l10n) => switch (this) {
        OrderStatus.processing => l10n.orderStatusProcessing,
        OrderStatus.outForDelivery => l10n.orderStatusOutForDelivery,
        OrderStatus.completed => l10n.orderStatusCompleted,
      };

  /// The installation job status that follows this order status.
  String jobLabel(AppLocalizations l10n) => switch (this) {
        OrderStatus.processing => l10n.jobStatusPending,
        OrderStatus.outForDelivery => l10n.jobStatusInProgress,
        OrderStatus.completed => l10n.orderStatusCompleted,
      };
}

extension PaymentStatusLabel on PaymentStatus {
  String label(AppLocalizations l10n) => switch (this) {
        PaymentStatus.pendingVerification => l10n.paymentStatusPending,
        PaymentStatus.confirmed => l10n.paymentStatusConfirmed,
      };
}

extension DeliveryMethodLabel on DeliveryMethod {
  String label(AppLocalizations l10n) => switch (this) {
        DeliveryMethod.delivery => l10n.deliveryMethodDelivery,
        DeliveryMethod.pickup => l10n.deliveryMethodPickup,
      };
}
