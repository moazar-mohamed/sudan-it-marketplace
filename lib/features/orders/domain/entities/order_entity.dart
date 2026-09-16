enum OrderStatus {
  processing('processing', 'Processing'),
  outForDelivery('out_for_delivery', 'Out for Delivery'),
  completed('completed', 'Completed');

  const OrderStatus(this.value, this.displayName);

  final String value;
  final String displayName;

  static OrderStatus fromValue(String? value) {
    return switch (value) {
      'out_for_delivery' || 'outForDelivery' => OrderStatus.outForDelivery,
      'completed' => OrderStatus.completed,
      _ => OrderStatus.processing,
    };
  }
}

enum PaymentStatus {
  pendingVerification('pending_verification', 'Pending Verification'),
  confirmed('confirmed', 'Confirmed');

  const PaymentStatus(this.value, this.displayName);

  final String value;
  final String displayName;

  static PaymentStatus fromValue(String? value) {
    return switch (value) {
      'confirmed' => PaymentStatus.confirmed,
      _ => PaymentStatus.pendingVerification,
    };
  }
}

enum DeliveryMethod {
  delivery('delivery', 'Delivery'),
  pickup('pickup', 'Pickup');

  const DeliveryMethod(this.value, this.displayName);

  final String value;
  final String displayName;

  static DeliveryMethod fromValue(String? value) {
    return value == 'pickup' ? DeliveryMethod.pickup : DeliveryMethod.delivery;
  }
}

class OrderEntity {
  const OrderEntity({
    required this.id,
    required this.customerId,
    required this.companyId,
    this.companyName = '',
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.productSubtotal,
    required this.installationSelected,
    required this.installationFee,
    required this.deliveryFee,
    required this.totalAmount,
    required this.deliveryAddress,
    required this.contactPhone,
    this.deliveryMethod = DeliveryMethod.delivery,
    this.customerName = '',
    this.paymentStatus = PaymentStatus.pendingVerification,
    this.orderStatus = OrderStatus.processing,
    this.receiptFileName,
    this.technicianId,
    this.technicianName,
    required this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String customerId;
  final String companyId;
  final String companyName;
  final String productId;
  final String productName;
  final int quantity;
  final double unitPrice;
  final double productSubtotal;
  final bool installationSelected;
  final double installationFee;
  final double deliveryFee;
  final double totalAmount;
  final String deliveryAddress;
  final String contactPhone;
  final DeliveryMethod deliveryMethod;
  final String customerName;
  final PaymentStatus paymentStatus;
  final OrderStatus orderStatus;
  final String? receiptFileName;

  /// Set only when this order's installation add-on has been assigned to a
  /// technician by the company admin.
  final String? technicianId;
  final String? technicianName;
  final DateTime createdAt;
  final DateTime? updatedAt;

  String get shortId => id.length > 8 ? id.substring(0, 8) : id;

  OrderEntity copyWith({
    String? id,
    String? customerId,
    String? companyId,
    String? companyName,
    String? productId,
    String? productName,
    int? quantity,
    double? unitPrice,
    double? productSubtotal,
    bool? installationSelected,
    double? installationFee,
    double? deliveryFee,
    double? totalAmount,
    String? deliveryAddress,
    String? contactPhone,
    DeliveryMethod? deliveryMethod,
    String? customerName,
    PaymentStatus? paymentStatus,
    OrderStatus? orderStatus,
    String? receiptFileName,
    String? technicianId,
    String? technicianName,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return OrderEntity(
      id: id ?? this.id,
      customerId: customerId ?? this.customerId,
      companyId: companyId ?? this.companyId,
      companyName: companyName ?? this.companyName,
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      quantity: quantity ?? this.quantity,
      unitPrice: unitPrice ?? this.unitPrice,
      productSubtotal: productSubtotal ?? this.productSubtotal,
      installationSelected: installationSelected ?? this.installationSelected,
      installationFee: installationFee ?? this.installationFee,
      deliveryFee: deliveryFee ?? this.deliveryFee,
      totalAmount: totalAmount ?? this.totalAmount,
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
      contactPhone: contactPhone ?? this.contactPhone,
      deliveryMethod: deliveryMethod ?? this.deliveryMethod,
      customerName: customerName ?? this.customerName,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      orderStatus: orderStatus ?? this.orderStatus,
      receiptFileName: receiptFileName ?? this.receiptFileName,
      technicianId: technicianId ?? this.technicianId,
      technicianName: technicianName ?? this.technicianName,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
