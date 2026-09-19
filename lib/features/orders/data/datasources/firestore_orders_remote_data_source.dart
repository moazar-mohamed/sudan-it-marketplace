import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../customer_dashboard/data/mock_marketplace_data.dart';
import '../../../products/data/models/product_model.dart';
import '../../../products/domain/stock_reservation.dart';
import '../../domain/entities/order_entity.dart';
import '../models/order_model.dart';
import 'orders_remote_data_source.dart';

class FirestoreOrdersRemoteDataSource implements OrdersRemoteDataSource {
  FirestoreOrdersRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _ordersCollection = 'orders';
  static const _productsCollection = 'products';
  static const _writeAcknowledgementTimeout = Duration(seconds: 20);
  static const _reconciliationTimeout = Duration(seconds: 10);
  static const _maxReservationAttempts = 4;
  final FirebaseFirestore _firestore;

  /// Creates the order and reserves its stock in one transaction.
  ///
  /// The product's `stockCount` is read, checked against the ordered
  /// quantity and lowered by exactly that quantity together with the order
  /// write, so two customers racing for the last units cannot both succeed.
  /// The loser's commit is refused (its read is stale); it then re-reads the
  /// product and is either rejected as out of stock or retried against the
  /// new stock. Stock is consumed when the order is placed (orders start as
  /// Processing / Pending Verification and the app has no cancel or reject
  /// step to give it back).
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
      final productRef =
          _firestore.collection(_productsCollection).doc(order.productId);

      for (var attempt = 1;; attempt++) {
        try {
          await _firestore
              .runTransaction(
                (transaction) => _reserveStockAndCreate(
                  transaction,
                  productRef,
                  docRef,
                  order,
                  data,
                ),
              )
              .timeout(_writeAcknowledgementTimeout);
          return docRef.id;
        } on TimeoutException {
          await _confirmOrderWasWritten(docRef, order);
          return docRef.id;
        } on FirebaseException catch (error) {
          // A commit whose acknowledgement was lost (or a retry of an order
          // that already went through) must not be reported as a failure, or
          // as a second reservation.
          if (await _matchesExpectedOrder(docRef, order)) {
            return docRef.id;
          }
          final lostRace =
              error.code == 'permission-denied' || error.code == 'aborted';
          if (lostRace) {
            await _throwIfStockRanOut(productRef, order);
            if (attempt < _maxReservationAttempts) {
              continue; // stock remains: retry with a fresh read
            }
          }
          throw Exception(_createOrderErrorMessage(error));
        }
      }
    } on Exception {
      rethrow;
    } catch (error) {
      throw Exception('Unexpected error creating order: $error');
    }
  }

  Future<void> _reserveStockAndCreate(
    Transaction transaction,
    DocumentReference<Map<String, dynamic>> productRef,
    DocumentReference<Map<String, dynamic>> orderRef,
    OrderModel order,
    Map<String, dynamic> orderData,
  ) async {
    final productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists) {
      // Only the built-in demo catalogue has no product document.
      if (!_isDemoProduct(order.productId)) {
        throw const StockUnavailableException(
          message: 'This product is no longer available.',
          available: 0,
          requested: 0,
        );
      }
      transaction.set(orderRef, orderData);
      return;
    }

    final product = ProductModel.fromFirestore(productSnapshot);
    // A product without a price has nothing to charge, so it cannot be ordered
    // through checkout (the company may also have removed the price after the
    // customer opened the screen).
    if (!product.hasPrice) {
      throw Exception(
        '${order.productName} has no listed price yet. '
        'Please contact the company to order it.',
      );
    }
    final remaining = StockReservation.remainingAfter(
      available: product.isAvailable ? product.stockCount : 0,
      requested: order.quantity,
      productName: order.productName,
    );
    transaction.update(productRef, {
      'stockCount': remaining,
      'lastOrderId': orderRef.id,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    transaction.set(orderRef, orderData);
  }

  Future<void> _confirmOrderWasWritten(
    DocumentReference<Map<String, dynamic>> docRef,
    OrderModel order,
  ) async {
    if (!await _matchesExpectedOrder(docRef, order)) {
      throw Exception(
        'Your order could not be confirmed. Check your connection and try again.',
      );
    }
  }

  /// When another customer takes units between our read and our commit, the
  /// rules refuse the commit (`permission-denied`) because the stock they
  /// check is already lower. Re-read the product: if there is no longer enough,
  /// tell the customer it is out of stock instead of showing a permissions
  /// error. Returns normally when enough stock remains (or the read fails).
  Future<void> _throwIfStockRanOut(
    DocumentReference<Map<String, dynamic>> productRef,
    OrderModel order,
  ) async {
    try {
      final snapshot = await productRef
          .get(const GetOptions(source: Source.server))
          .timeout(_reconciliationTimeout);
      if (!snapshot.exists) {
        return;
      }
      final product = ProductModel.fromFirestore(snapshot);
      StockReservation.remainingAfter(
        available: product.isAvailable ? product.stockCount : 0,
        requested: order.quantity,
        productName: order.productName,
      );
    } on TimeoutException {
      return;
    } on FirebaseException {
      return;
    }
  }

  bool _isDemoProduct(String productId) =>
      mockProducts.any((product) => product.id == productId);

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
  Stream<List<OrderModel>> watchTechnicianOrders(String technicianId) {
    if (technicianId.isEmpty) {
      return Stream.value(const []);
    }
    return _firestore
        .collection(_ordersCollection)
        .where('technicianId', isEqualTo: technicianId)
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
