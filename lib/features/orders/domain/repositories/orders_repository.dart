import '../entities/order_entity.dart';
import '../entities/order_receipt.dart';

abstract interface class OrdersRepository {
  /// Places the order with its payment [receipt], which is required: without
  /// one nothing is sent. The order takes no stock until the company confirms
  /// its payment. A customer who placed 5 orders in the last 24 hours gets an
  /// `OrderQuotaReachedException`.
  Future<OrderEntity> createOrder({
    required String orderId,
    required String customerId,
    required String companyId,
    String companyName = '',
    required String productId,
    required String productName,
    required int quantity,
    required double unitPrice,
    required double productSubtotal,
    required bool installationSelected,
    required double installationFee,
    required double deliveryFee,
    required double totalAmount,
    required String deliveryAddress,
    required String contactPhone,
    DeliveryMethod deliveryMethod = DeliveryMethod.delivery,
    String customerName = '',
    String? receiptFileName,
    double? deliveryLatitude,
    double? deliveryLongitude,
    ReceiptImage? receipt,
  });

  /// The stored receipt image of [orderId]; null when the order has none
  /// (orders placed before receipts were stored).
  Future<OrderReceipt?> getReceipt(String orderId);

  Future<void> attachReceipt({
    required String orderId,
    required String receiptFileName,
  });

  Future<OrderEntity?> getOrderById(String orderId);

  /// Live updates to one order, for a screen that only needs a single order
  /// (its own conversation, for instance) rather than a whole list.
  Stream<OrderEntity?> watchOrder(String orderId);

  Stream<List<OrderEntity>> watchCustomerOrders(String customerId);

  Stream<List<OrderEntity>> watchCompanyOrders(String companyId);

  /// Watches only the orders whose installation add-on is assigned to this
  /// technician.
  Stream<List<OrderEntity>> watchTechnicianOrders(String technicianId);

  Future<void> updateOrderStatus({
    required String orderId,
    required OrderStatus orderStatus,
  });

  /// The company confirms the payment of [orderId] and takes its stock from
  /// its product in the same transaction, exactly once. Returns the order as
  /// the server stores it afterwards. Not enough stock writes nothing
  /// (`StockUnavailableException`); the other refusals are
  /// `PaymentConfirmationException`s.
  Future<OrderEntity> confirmPayment(String orderId);

  /// The company cancels [orderId] while it is still Processing, its payment
  /// waiting or confirmed; the stock it took goes back to its product in the
  /// same transaction, at most once. Expired and out of stock are only for an
  /// order whose payment is still waiting.
  Future<void> cancelOrder({
    required String orderId,
    required OrderCancelReason reason,
  });

  /// Cancels as expired the company's orders whose payment was not verified
  /// within [OrderEntity.paymentVerificationWindow]; returns how many. Run
  /// when the company opens its Orders page (there is no server to do it).
  Future<int> expireOverdueOrders(String companyId);

  /// Assigns a technician to this order's installation add-on. Only valid
  /// for orders where [OrderEntity.installationSelected] is true.
  Future<void> assignTechnician({
    required String orderId,
    required String technicianId,
    required String technicianName,
  });

  /// Opens the conversation with the order's company, for an order placed
  /// before every order got one automatically. A no-op (never throws) if the
  /// conversation already exists.
  Future<void> startChat(OrderEntity order);
}
