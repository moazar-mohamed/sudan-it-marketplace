import 'order_entity.dart';

class CheckoutOrderDraft {
  const CheckoutOrderDraft({
    required this.orderId,
    required this.customerId,
    required this.companyId,
    required this.companyName,
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
    this.deliveryLatitude,
    this.deliveryLongitude,
  });

  final String orderId;
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

  /// Exact delivery point chosen on the map (delivery orders only).
  final double? deliveryLatitude;
  final double? deliveryLongitude;
}
