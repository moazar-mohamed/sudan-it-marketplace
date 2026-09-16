import '../models/order_model.dart';

abstract interface class OrdersRemoteDataSource {
  Future<String> createOrder(OrderModel order);

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
