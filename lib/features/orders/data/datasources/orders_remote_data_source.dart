import '../models/order_model.dart';
import '../../domain/entities/order_entity.dart';
import '../../domain/entities/order_receipt.dart';
import '../../domain/order_exceptions.dart';
import '../../domain/order_quota.dart';

/// What placing an order stored: its id, and the two names it carries. The
/// names are the product's own, read when the order was written, whatever the
/// checkout had on screen (a product may be renamed while the customer pays).
typedef CreatedOrder = ({String id, String productName, String companyName});

abstract interface class OrdersRemoteDataSource {
  /// Creates the order. Its [receipt] is required (without one nothing is
  /// sent): the image is stored in the SAME transaction
  /// (`order_receipts/{orderId}`) as the order, its conversation and one step
  /// of the customer's order quota, so an order never exists without the
  /// receipt it was placed with, nor a receipt without its order. The order
  /// takes no stock: that happens when the company confirms the payment.
  /// A customer with [OrderQuota.ordersPerDay] orders in the last 24 hours
  /// gets an [OrderQuotaReachedException] and nothing is written.
  ///
  /// The `productName` and `companyName` of [order] are NOT what is stored:
  /// both are taken from the product document read in that transaction (the
  /// security rules accept nothing else), and come back in the result.
  Future<CreatedOrder> createOrder(OrderModel order, {ReceiptImage? receipt});

  /// The stored receipt of [orderId]; null for an order placed before
  /// receipts were stored (or one without an image).
  Future<OrderReceipt?> getReceipt(String orderId);

  Future<void> attachReceipt({
    required String orderId,
    required String receiptFileName,
  });

  Future<OrderModel?> getOrderById(String orderId);

  Stream<OrderModel?> watchOrder(String orderId);

  Stream<List<OrderModel>> watchCustomerOrders(String customerId);

  Stream<List<OrderModel>> watchCompanyOrders(String companyId);

  Stream<List<OrderModel>> watchTechnicianOrders(String technicianId);

  Future<void> updateOrderStatus({
    required String orderId,
    required String orderStatus,
  });

  /// The company confirms the payment of [orderId] and takes its stock from
  /// its product in the same transaction, exactly once. Returns the order as
  /// the server stores it afterwards. Not enough stock writes nothing
  /// (`StockUnavailableException`); the other refusals are
  /// [PaymentConfirmationException]s.
  Future<OrderModel> confirmPayment(String orderId);

  /// The company cancels [orderId] while it is still Processing, its payment
  /// waiting or confirmed; the stock it took goes back to its product in the
  /// same transaction, at most once.
  Future<void> cancelOrder({
    required String orderId,
    required OrderCancelReason reason,
  });

  /// Cancels as expired the company's orders whose payment was not verified
  /// within [OrderEntity.paymentVerificationWindow]; returns how many.
  Future<int> expireOverdueOrders(String companyId);

  Future<void> assignTechnician({
    required String orderId,
    required String technicianId,
    required String technicianName,
  });

  /// Opens the conversation with the order's company, for an order placed
  /// before every order got one automatically. A no-op if it already exists.
  Future<void> startChat({
    required String orderId,
    required String customerId,
    required String companyId,
    required String customerName,
    required String companyName,
    required String productName,
  });
}
