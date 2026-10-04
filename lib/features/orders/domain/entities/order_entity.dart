import '../../../location/domain/geo_location.dart';
import '../../../../core/utils/short_id.dart';

enum OrderStatus {
  processing('processing', 'Processing'),
  outForDelivery('out_for_delivery', 'Out for Delivery'),
  completed('completed', 'Completed'),

  /// Final: cancelled by its company while still Processing (see
  /// [OrderCancelReason]). Nothing moves it again.
  cancelled('cancelled', 'Cancelled');

  const OrderStatus(this.value, this.displayName);

  final String value;
  final String displayName;

  static OrderStatus fromValue(String? value) {
    return switch (value) {
      'out_for_delivery' || 'outForDelivery' => OrderStatus.outForDelivery,
      'completed' => OrderStatus.completed,
      'cancelled' => OrderStatus.cancelled,
      _ => OrderStatus.processing,
    };
  }
}

/// Why an order was cancelled.
enum OrderCancelReason {
  /// The company cancelled it by hand.
  company('company'),

  /// Its payment was not verified within [OrderEntity.paymentVerificationWindow].
  expired('expired'),

  /// Its payment was not verified yet and its product can no longer cover it
  /// (gone, now another company's, or fewer units left than ordered), so it
  /// could never be confirmed. The company returns the money outside the app.
  outOfStock('out_of_stock'),

  /// Platform Admin cancelled it while it was stuck.
  admin('admin');

  const OrderCancelReason(this.value);

  final String value;

  /// The stored reason, or null when there is none (or it is unknown).
  static OrderCancelReason? fromValue(Object? value) {
    for (final reason in values) {
      if (reason.value == value) return reason;
    }
    return null;
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
    this.deliveryLatitude,
    this.deliveryLongitude,
    this.technicianId,
    this.technicianName,
    this.stockReserved = false,
    this.stockReleased = false,
    this.cancelReason,
    this.cancelledAt,
    required this.createdAt,
    this.updatedAt,
  });

  /// How long the company has to verify a new order's payment. After that
  /// the order may be cancelled as expired (the security rules decide with
  /// the server's clock; the company's app does it when its Orders page is
  /// opened).
  static const paymentVerificationWindow = Duration(hours: 24);

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

  /// Exact delivery point the customer chose on the map at checkout. Optional
  /// (text-only and pickup orders have none) and never changed afterwards.
  final double? deliveryLatitude;
  final double? deliveryLongitude;

  /// Set only when this order's installation add-on has been assigned to a
  /// technician by the company admin.
  final String? technicianId;
  final String? technicianName;

  /// The order's quantity has been taken from its product's stock: in the
  /// same write that confirmed its payment, or, for an order placed before
  /// stock moved to the confirmation (stored with true, or with no such
  /// field at all), when it was placed. A new order starts without it. A
  /// cancellation gives back exactly this, once.
  final bool stockReserved;

  /// A cancellation gave the order's stock back to the product.
  final bool stockReleased;

  /// Set only on a cancelled order.
  final OrderCancelReason? cancelReason;
  final DateTime? cancelledAt;
  final DateTime createdAt;
  final DateTime? updatedAt;

  String get shortId => shortReference(id);

  bool get isCancelled => orderStatus == OrderStatus.cancelled;

  /// Still Processing with its payment waiting for the company's
  /// verification: the only state in which the payment can be confirmed.
  bool get isAwaitingPaymentVerification =>
      orderStatus == OrderStatus.processing &&
      paymentStatus == PaymentStatus.pendingVerification;

  /// The company may cancel the order: it is still Processing, whether its
  /// payment is waiting or already confirmed (then the company refunds the
  /// customer outside the app). The rules enforce the same.
  bool get companyMayCancel => orderStatus == OrderStatus.processing;

  /// Whether the payment verification window has passed at [now]. Only an
  /// order still waiting for its payment to be verified can be overdue: a
  /// confirmed one never is. Only a hint for choosing which orders to try to
  /// expire: the security rules decide with the server's clock, so a wrong
  /// phone clock can delay an expiry but never cause an early one.
  bool isPaymentVerificationOverdue(DateTime now) =>
      isAwaitingPaymentVerification &&
      !now.isBefore(createdAt.add(paymentVerificationWindow));

  /// The delivery point saved with this order, or null when the customer only
  /// typed an address (or the order is a pickup / legacy order).
  GeoLocation? get deliveryCoordinates =>
      GeoLocation.tryCreate(deliveryLatitude, deliveryLongitude);

  bool get hasDeliveryCoordinates => deliveryCoordinates != null;

  /// The written delivery address, null when empty (map-only orders).
  String? get deliveryText {
    final text = deliveryAddress.trim();
    return text.isEmpty ? null : text;
  }

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
    double? deliveryLatitude,
    double? deliveryLongitude,
    String? technicianId,
    String? technicianName,
    bool? stockReserved,
    bool? stockReleased,
    OrderCancelReason? cancelReason,
    DateTime? cancelledAt,
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
      deliveryLatitude: deliveryLatitude ?? this.deliveryLatitude,
      deliveryLongitude: deliveryLongitude ?? this.deliveryLongitude,
      technicianId: technicianId ?? this.technicianId,
      technicianName: technicianName ?? this.technicianName,
      stockReserved: stockReserved ?? this.stockReserved,
      stockReleased: stockReleased ?? this.stockReleased,
      cancelReason: cancelReason ?? this.cancelReason,
      cancelledAt: cancelledAt ?? this.cancelledAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
