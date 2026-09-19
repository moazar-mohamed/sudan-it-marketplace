import '../entities/order_entity.dart';

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
  });

  Future<void> attachReceipt({
    required String orderId,
    required String receiptFileName,
  });

  Future<OrderEntity?> getOrderById(String orderId);

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
}
