/// Why the company could not confirm an order's payment. Nothing was written:
/// no stock was taken and the order is unchanged.
enum PaymentConfirmationIssue {
  /// The payment was already confirmed, possibly from another device of the
  /// same company. Its stock was taken then, once.
  alreadyConfirmed,

  /// The order is cancelled, has moved on (Out for Delivery, Completed) or
  /// is gone: only a Processing order waiting for verification is confirmed.
  notAwaitingPayment,

  /// The order has no stored receipt (it was placed before receipts were
  /// stored). It cannot be confirmed until one exists.
  noReceipt,
}

class PaymentConfirmationException implements Exception {
  const PaymentConfirmationException(this.issue);

  final PaymentConfirmationIssue issue;

  @override
  String toString() => 'PaymentConfirmationException(${issue.name})';
}

/// "Out of stock" may be given as the cancel reason only when the order's
/// product can no longer cover it; this product still can, so the payment
/// can be confirmed instead. Nothing was written.
class ProductStillCoversOrderException implements Exception {
  const ProductStillCoversOrderException({
    required this.available,
    required this.requested,
  });

  final int available;
  final int requested;

  @override
  String toString() =>
      'ProductStillCoversOrderException($available left, $requested ordered)';
}
