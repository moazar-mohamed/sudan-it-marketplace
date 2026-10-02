import '../../../core/localization/error_messages.dart';
import '../../../l10n/app_localizations.dart';
import '../../products/domain/stock_reservation.dart';
import '../../products/presentation/stock_error_message.dart';
import '../domain/order_exceptions.dart';
import '../domain/order_quota.dart';

/// A time as the order screens show it: `yyyy-MM-dd HH:mm`, on the phone's
/// clock.
String orderTimeLabel(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)} '
      '${two(local.hour)}:${two(local.minute)}';
}

/// The customer's text for an order that could not be placed: the order
/// quota, a stock problem, otherwise the general resolver.
String customerOrderErrorMessage(AppLocalizations l10n, Object error) {
  return switch (error) {
    OrderQuotaReachedException(:final nextOrderAt) => nextOrderAt == null
        ? l10n.orderQuotaReachedNoTime(OrderQuota.ordersPerDay)
        : l10n.orderQuotaReached(
            OrderQuota.ordersPerDay,
            orderTimeLabel(nextOrderAt),
          ),
    StockUnavailableException() => stockErrorMessage(l10n, error),
    _ => localizedErrorMessage(l10n, error),
  };
}

/// The company's text for a step on an order that was refused (confirming
/// the payment, cancelling): nothing was written in any of these cases.
String companyOrderErrorMessage(AppLocalizations l10n, Object error) {
  return switch (error) {
    PaymentConfirmationException(:final issue) => switch (issue) {
        PaymentConfirmationIssue.alreadyConfirmed =>
          l10n.orderPaymentAlreadyConfirmed,
        PaymentConfirmationIssue.notAwaitingPayment =>
          l10n.orderPaymentNotAwaiting,
        PaymentConfirmationIssue.noReceipt => l10n.orderPaymentNoReceipt,
      },
    // Confirming the payment needs the product to cover the order.
    StockUnavailableException(issue: StockIssue.noLongerAvailable) =>
      l10n.adminProductGoneCannotConfirm,
    StockUnavailableException(:final available, :final requested) =>
      l10n.adminStockCannotCover(available, requested),
    ProductStillCoversOrderException(:final available, :final requested) =>
      l10n.adminOutOfStockStillCovers(available, requested),
    _ => localizedErrorMessage(l10n, error),
  };
}
