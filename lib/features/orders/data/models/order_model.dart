import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../location/domain/geo_location.dart';
import '../../domain/entities/order_entity.dart';

class OrderModel {
  const OrderModel({
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
    required this.paymentStatus,
    required this.orderStatus,
    this.receiptFileName,
    this.deliveryLatitude,
    this.deliveryLongitude,
    this.technicianId,
    this.technicianName,
    required this.createdAt,
    this.updatedAt,
  });

  factory OrderModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? {};
    return OrderModel.fromMap(data, snapshot.id);
  }

  factory OrderModel.fromMap(Map<String, dynamic> map, String docId) {
    DateTime parseTimestamp(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      return DateTime.now();
    }

    // Older orders have no coordinates; a non-numeric value is ignored.
    final delivery =
        GeoLocation.tryCreate(map['deliveryLatitude'], map['deliveryLongitude']);

    return OrderModel(
      id: docId,
      customerId: map['customerId'] as String? ?? '',
      companyId: map['companyId'] as String? ?? '',
      companyName: map['companyName'] as String? ?? '',
      productId: map['productId'] as String? ?? '',
      productName: map['productName'] as String? ?? '',
      quantity: (map['quantity'] as num?)?.toInt() ?? 1,
      unitPrice: (map['unitPrice'] as num?)?.toDouble() ?? 0.0,
      productSubtotal: (map['productSubtotal'] as num?)?.toDouble() ?? 0.0,
      installationSelected: map['installationSelected'] as bool? ?? false,
      installationFee: (map['installationFee'] as num?)?.toDouble() ?? 0.0,
      deliveryFee: (map['deliveryFee'] as num?)?.toDouble() ?? 0.0,
      totalAmount: (map['totalAmount'] as num?)?.toDouble() ?? 0.0,
      deliveryAddress: map['deliveryAddress'] as String? ?? '',
      contactPhone: map['contactPhone'] as String? ?? '',
      deliveryMethod: DeliveryMethod.fromValue(map['deliveryMethod'] as String?),
      customerName: map['customerName'] as String? ?? '',
      paymentStatus: PaymentStatus.fromValue(map['paymentStatus'] as String?),
      orderStatus: OrderStatus.fromValue(map['orderStatus'] as String?),
      receiptFileName: map['receiptFileName'] as String?,
      deliveryLatitude: delivery?.latitude,
      deliveryLongitude: delivery?.longitude,
      technicianId: map['technicianId'] as String?,
      technicianName: map['technicianName'] as String?,
      createdAt: parseTimestamp(map['createdAt']),
      updatedAt: map['updatedAt'] != null ? parseTimestamp(map['updatedAt']) : null,
    );
  }

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
  final double? deliveryLatitude;
  final double? deliveryLongitude;
  final String? technicianId;
  final String? technicianName;
  final DateTime createdAt;
  final DateTime? updatedAt;

  Map<String, dynamic> toFirestoreCreateMap() {
    final delivery = GeoLocation.tryCreate(deliveryLatitude, deliveryLongitude);
    return {
      'id': id,
      'customerId': customerId,
      'companyId': companyId,
      'companyName': companyName,
      'productId': productId,
      'productName': productName,
      'quantity': quantity,
      'unitPrice': unitPrice,
      'productSubtotal': productSubtotal,
      'installationSelected': installationSelected,
      'installationFee': installationFee,
      'deliveryFee': deliveryFee,
      'totalAmount': totalAmount,
      'deliveryAddress': deliveryAddress,
      'contactPhone': contactPhone,
      'deliveryMethod': deliveryMethod.value,
      'customerName': customerName,
      'paymentStatus': paymentStatus.value,
      'orderStatus': orderStatus.value,
      'receiptFileName': receiptFileName,
      // Only written when the customer picked a point on the map; stored as
      // numbers, never strings.
      if (delivery != null) ...{
        'deliveryLatitude': delivery.latitude,
        'deliveryLongitude': delivery.longitude,
      },
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  OrderEntity toEntity() {
    return OrderEntity(
      id: id,
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
      paymentStatus: paymentStatus,
      orderStatus: orderStatus,
      receiptFileName: receiptFileName,
      deliveryLatitude: deliveryLatitude,
      deliveryLongitude: deliveryLongitude,
      technicianId: technicianId,
      technicianName: technicianName,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
