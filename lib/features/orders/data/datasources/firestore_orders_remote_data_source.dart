import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/order_entity.dart';
import '../models/order_model.dart';
import 'orders_remote_data_source.dart';

class FirestoreOrdersRemoteDataSource implements OrdersRemoteDataSource {
  FirestoreOrdersRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _ordersCollection = 'orders';
  static const _writeAcknowledgementTimeout = Duration(seconds: 20);
  static const _reconciliationTimeout = Duration(seconds: 10);
  final FirebaseFirestore _firestore;

  @override
  Future<String> createOrder(OrderModel order) async {
    try {
      final docRef = order.id.isNotEmpty
          ? _firestore.collection(_ordersCollection).doc(order.id)
          : _firestore.collection(_ordersCollection).doc();

      final data = {
        ...order.toFirestoreCreateMap(),
        'id': docRef.id,
      };

      try {
        await docRef.set(data).timeout(_writeAcknowledgementTimeout);
      } on TimeoutException {
        final wasWritten = await _matchesExpectedOrder(docRef, order);
        if (!wasWritten) {
          throw Exception(
            'Your order could not be confirmed. Check your connection and try again.',
          );
        }
      }
      return docRef.id;
    } on FirebaseException catch (error) {
      throw Exception(_createOrderErrorMessage(error));
    } on Exception {
      rethrow;
    } catch (error) {
      throw Exception('Unexpected error creating order: $error');
    }
  }

  Future<bool> _matchesExpectedOrder(
    DocumentReference<Map<String, dynamic>> docRef,
    OrderModel expected,
  ) async {
    try {
      final snapshot = await docRef
          .get(const GetOptions(source: Source.server))
          .timeout(_reconciliationTimeout);
      if (!snapshot.exists) {
        return false;
      }

      final data = snapshot.data();
      if (data == null) {
        return false;
      }

      return data['id'] == docRef.id &&
          data['customerId'] == expected.customerId &&
          data['companyId'] == expected.companyId &&
          data['companyName'] == expected.companyName &&
          data['productId'] == expected.productId &&
          data['productName'] == expected.productName &&
          data['quantity'] == expected.quantity &&
          data['unitPrice'] == expected.unitPrice &&
          data['productSubtotal'] == expected.productSubtotal &&
          data['installationSelected'] == expected.installationSelected &&
          data['installationFee'] == expected.installationFee &&
          data['deliveryFee'] == expected.deliveryFee &&
          data['totalAmount'] == expected.totalAmount &&
          data['deliveryAddress'] == expected.deliveryAddress &&
          data['contactPhone'] == expected.contactPhone &&
          data['paymentStatus'] == expected.paymentStatus.value &&
          data['orderStatus'] == expected.orderStatus.value &&
          data['receiptFileName'] == expected.receiptFileName;
    } on TimeoutException {
      return false;
    } on FirebaseException {
      return false;
    }
  }

  String _createOrderErrorMessage(FirebaseException error) {
    switch (error.code) {
      case 'permission-denied':
        return 'You do not have permission to place this order. Please sign in again and try again.';
      case 'unavailable':
      case 'network-request-failed':
        return 'The order could not be confirmed. Check your internet connection and try again.';
      default:
        return 'Failed to create order: ${error.message ?? error.code}';
    }
  }

  @override
  Future<void> attachReceipt({
    required String orderId,
    required String receiptFileName,
  }) async {
    try {
      await _firestore.collection(_ordersCollection).doc(orderId).update({
        'receiptFileName': receiptFileName,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw Exception('Failed to attach receipt: ${error.message ?? error.code}');
    } catch (error) {
      throw Exception('Unexpected error attaching receipt: $error');
    }
  }

  @override
  Future<OrderModel?> getOrderById(String orderId) async {
    try {
      final doc =
          await _firestore.collection(_ordersCollection).doc(orderId).get();
      if (!doc.exists || doc.data() == null) {
        return null;
      }
      return OrderModel.fromFirestore(doc);
    } on FirebaseException catch (error) {
      throw Exception('Failed to fetch order: ${error.message ?? error.code}');
    } catch (error) {
      throw Exception('Unexpected error fetching order: $error');
    }
  }

  @override
  Stream<List<OrderModel>> watchCustomerOrders(String customerId) {
    return _firestore
        .collection(_ordersCollection)
        .where('customerId', isEqualTo: customerId)
        .snapshots()
        .map((snapshot) {
      final list = snapshot.docs.map(OrderModel.fromFirestore).toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  @override
  Stream<List<OrderModel>> watchCompanyOrders(String companyId) {
    return _firestore
        .collection(_ordersCollection)
        .where('companyId', isEqualTo: companyId)
        .snapshots()
        .map((snapshot) {
      final list = snapshot.docs.map(OrderModel.fromFirestore).toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  @override
  Future<void> updateOrderStatus({
    required String orderId,
    required String orderStatus,
  }) async {
    try {
      await _firestore.collection(_ordersCollection).doc(orderId).update({
        'orderStatus': orderStatus,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw Exception(_companyUpdateErrorMessage(error, 'update order status'));
    }
  }

  @override
  Future<void> confirmPayment(String orderId) async {
    try {
      await _firestore.collection(_ordersCollection).doc(orderId).update({
        'paymentStatus': PaymentStatus.confirmed.value,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw Exception(_companyUpdateErrorMessage(error, 'confirm payment'));
    }
  }

  @override
  Future<void> assignTechnician({
    required String orderId,
    required String technicianId,
    required String technicianName,
  }) async {
    try {
      await _firestore.collection(_ordersCollection).doc(orderId).update({
        'technicianId': technicianId,
        'technicianName': technicianName,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw Exception(_companyUpdateErrorMessage(error, 'assign a technician'));
    }
  }

  String _companyUpdateErrorMessage(FirebaseException error, String action) {
    if (error.code == 'permission-denied') {
      return 'You do not have permission to $action for this order.';
    }
    return 'Could not $action: ${error.message ?? error.code}';
  }
}
