import '../../domain/entities/order_entity.dart';
import '../../domain/repositories/orders_repository.dart';
import '../datasources/orders_remote_data_source.dart';
import '../models/order_model.dart';

class OrdersRepositoryImpl implements OrdersRepository {
  const OrdersRepositoryImpl(this._remoteDataSource);

  final OrdersRemoteDataSource _remoteDataSource;

  @override
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
  }) async {
    final model = OrderModel(
      id: orderId,
      customerId: customerId,
      companyId: companyId,
      companyName: companyName,
      productId: productId,
      productName: productName,
      quantity: quantity,
      unitPrice: unitPrice,
      productSubtotal: productSubtotal,
      installationSelected: installationSelected,
      installationFee: installationFee,
      deliveryFee: deliveryFee,
      totalAmount: totalAmount,
      deliveryAddress: deliveryAddress,
      contactPhone: contactPhone,
      deliveryMethod: deliveryMethod,
      customerName: customerName,
      paymentStatus: PaymentStatus.pendingVerification,
      orderStatus: OrderStatus.processing,
      receiptFileName: receiptFileName,
      deliveryLatitude: deliveryLatitude,
      deliveryLongitude: deliveryLongitude,
      createdAt: DateTime.now(),
    );

    final generatedId = await _remoteDataSource.createOrder(model);
    return model.toEntity().copyWith(id: generatedId);
  }

  @override
  Future<void> attachReceipt({
    required String orderId,
    required String receiptFileName,
  }) {
    return _remoteDataSource.attachReceipt(
      orderId: orderId,
      receiptFileName: receiptFileName,
    );
  }

  @override
  Future<OrderEntity?> getOrderById(String orderId) async {
    final model = await _remoteDataSource.getOrderById(orderId);
    return model?.toEntity();
  }

  @override
  Stream<List<OrderEntity>> watchCustomerOrders(String customerId) {
    return _remoteDataSource
        .watchCustomerOrders(customerId)
        .map((models) => models.map((m) => m.toEntity()).toList());
  }

  @override
  Stream<List<OrderEntity>> watchCompanyOrders(String companyId) {
    return _remoteDataSource
        .watchCompanyOrders(companyId)
        .map((models) => models.map((m) => m.toEntity()).toList());
  }

  @override
  Stream<List<OrderEntity>> watchTechnicianOrders(String technicianId) {
    return _remoteDataSource
        .watchTechnicianOrders(technicianId)
        .map((models) => models.map((m) => m.toEntity()).toList());
  }

  @override
  Future<void> updateOrderStatus({
    required String orderId,
    required OrderStatus orderStatus,
  }) {
    return _remoteDataSource.updateOrderStatus(
      orderId: orderId,
      orderStatus: orderStatus.value,
    );
  }

  @override
  Future<void> confirmPayment(String orderId) {
    return _remoteDataSource.confirmPayment(orderId);
  }

  @override
  Future<void> assignTechnician({
    required String orderId,
    required String technicianId,
    required String technicianName,
  }) {
    return _remoteDataSource.assignTechnician(
      orderId: orderId,
      technicianId: technicianId,
      technicianName: technicianName,
    );
  }
}
