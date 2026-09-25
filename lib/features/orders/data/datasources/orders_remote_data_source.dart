import '../models/order_model.dart';
import '../../domain/entities/order_receipt.dart';

abstract interface class OrdersRemoteDataSource {
  /// Creates the order. With a [receipt], its image is stored in the SAME
  /// transaction (`order_receipts/{orderId}`), so an order never exists
  /// without the receipt it was placed with, nor a receipt without its order.
  Future<String> createOrder(OrderModel order, {ReceiptImage? receipt});

  /// The stored receipt of [orderId]; null for an order placed before
  /// receipts were stored (or one without an image).
  Future<OrderReceipt?> getReceipt(String orderId);

  Future<void> attachReceipt({
    required String orderId,
    required String receiptFileName,
  });

  Future<OrderModel?> getOrderById(String orderId);

  Stream<List<OrderModel>> watchCustomerOrders(String customerId);

  Stream<List<OrderModel>> watchCompanyOrders(String companyId);

  Stream<List<OrderModel>> watchTechnicianOrders(String technicianId);

  Future<void> updateOrderStatus({
    required String orderId,
    required String orderStatus,
  });

  Future<void> confirmPayment(String orderId);

  Future<void> assignTechnician({
    required String orderId,
    required String technicianId,
    required String technicianName,
  });
}
