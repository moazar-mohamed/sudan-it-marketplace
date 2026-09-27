import '../entities/order_entity.dart';
import '../entities/order_receipt.dart';

abstract interface class OrdersRepository {
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

  Future<void> confirmPayment(String orderId);

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
