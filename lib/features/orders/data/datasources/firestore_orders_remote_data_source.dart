import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart' show listEquals;

import '../../../../core/errors/app_exception.dart';
import '../../../chats/data/models/chat_models.dart';
import '../../../products/data/models/product_model.dart';
import '../../../products/domain/stock_reservation.dart';
import '../../domain/entities/order_entity.dart';
import '../../domain/order_exceptions.dart';
import '../../domain/order_pricing.dart';
import '../../domain/order_quota.dart';
import '../models/order_model.dart';
import '../models/order_quota_model.dart';
import 'orders_remote_data_source.dart';
import '../../domain/entities/order_receipt.dart';
import '../models/order_receipt_model.dart';

class FirestoreOrdersRemoteDataSource implements OrdersRemoteDataSource {
  FirestoreOrdersRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _ordersCollection = 'orders';
  static const _productsCollection = 'products';
  static const _chatsCollection = 'chats';
  static const _writeAcknowledgementTimeout = Duration(seconds: 20);
  // A receipt adds a few hundred KB to the commit: allow for slow mobile links.
  static const _receiptWriteAcknowledgementTimeout = Duration(seconds: 60);
  static const _reconciliationTimeout = Duration(seconds: 10);
  static const _maxAttempts = 4;

  /// What tells that a product or a quota changed between two reads: every
  /// product write sets `updatedAt` to the server's time (the rules require
  /// it), and every quota step moves `next` and `lastOrderId`.
  static const _productVersionKeys = ['updatedAt', 'stockCount'];
  static const _quotaVersionKeys = ['next', 'lastOrderId'];

  /// The fields that identify an order as the one this app wrote, when its
  /// commit's answer was lost.
  static const _identifyingOrderKeys = [
    'id',
    'customerId',
    'companyId',
    'productId',
    'quantity',
    'unitPrice',
    'productSubtotal',
    'installationSelected',
    'installationFee',
    'deliveryFee',
    'totalAmount',
    'deliveryAddress',
    'contactPhone',
    'paymentStatus',
    'orderStatus',
    'receiptFileName',
  ];

  final FirebaseFirestore _firestore;

  /// Places the order in ONE transaction, together with its payment receipt,
  /// its conversation with the company and one step of the customer's order
  /// quota, so all of them exist or none does. The order takes no stock: the
  /// company takes it when it confirms the payment ([confirmPayment]), and
  /// the product is never written here.
  ///
  /// The product is read to check what the rules check: it still belongs to
  /// the company, has a price, the price the customer saw, and at least the
  /// ordered quantity. The quota is read so that a sixth order within 24
  /// hours is refused before anything is sent ([OrderQuotaReachedException]).
  ///
  /// The order's product and company names are the product's own, taken from
  /// that same read: whatever names [order] carries are ignored. They go into
  /// the order, into its conversation and into the result, so nothing built
  /// afterwards (the "new order" notification, the confirmation screen) uses
  /// a name that was on screen but is not the one stored. Likewise the order
  /// records the name of the receipt it is stored with.
  ///
  /// A commit refused because the product or the quota changed meanwhile
  /// (another order of the same customer, an edit by the company) is tried
  /// again with fresh reads; any other refusal is not. A commit whose answer
  /// was lost is recognised by reading the order back, so an order is never
  /// placed, or counted against the quota, twice.
  @override
  Future<CreatedOrder> createOrder(
    OrderModel order, {
    ReceiptImage? receipt,
  }) async {
    // Every order is placed with its receipt; the rules refuse one without.
    if (receipt == null) {
      throw const AppException(
        AppErrorCode.orderCreateFailed,
        detail: 'an order is placed together with its payment receipt',
      );
    }
    try {
      final docRef = order.id.isNotEmpty
          ? _firestore.collection(_ordersCollection).doc(order.id)
          : _firestore.collection(_ordersCollection).doc();

      final data = {
        ...order.toFirestoreCreateMap(),
        'id': docRef.id,
        'receiptFileName': receipt.fileName,
      };
      final productRef =
          _firestore.collection(_productsCollection).doc(order.productId);
      final quotaRef = _firestore
          .collection(OrderQuotaModel.collection)
          .doc(order.customerId);
      // The receipt shares the order's id.
      final receiptRef =
          _firestore.collection(OrderReceiptModel.collection).doc(docRef.id);
      final receiptData = OrderReceiptModel.toFirestoreCreateMap(
        orderId: docRef.id,
        customerId: order.customerId,
        companyId: order.companyId,
        image: receipt,
      );
      // The conversation with the company shares the order's id too.
      final chatRef = _firestore.collection(_chatsCollection).doc(docRef.id);

      for (var attempt = 1;; attempt++) {
        final read = _PlacementRead();
        try {
          final names = await _firestore
              .runTransaction(
                (transaction) => _placeOrder(
                  transaction,
                  read: read,
                  productRef: productRef,
                  quotaRef: quotaRef,
                  orderRef: docRef,
                  order: order,
                  orderData: data,
                  receiptRef: receiptRef,
                  receiptData: receiptData,
                  chatRef: chatRef,
                ),
              )
              .timeout(_receiptWriteAcknowledgementTimeout);
          return (
            id: docRef.id,
            productName: names.productName,
            companyName: names.companyName,
          );
        } on TimeoutException {
          final stored = await _storedOrder(docRef, data);
          if (stored == null) {
            throw const AppException(AppErrorCode.orderNotConfirmed);
          }
          return stored;
        } on FirebaseException catch (error) {
          // A commit whose acknowledgement was lost (or a retry of an order
          // that already went through) must not be reported as a failure, or
          // placed again.
          final stored = await _storedOrder(docRef, data);
          if (stored != null) {
            return stored;
          }
          if (_isRefusal(error)) {
            if (attempt < _maxAttempts &&
                await _changedSince(read, productRef, quotaRef)) {
              continue; // retry against the newer product or quota
            }
            // Lost every race to the same customer's other orders: if those
            // filled the quota, say so rather than "not allowed".
            await _throwIfQuotaReached(quotaRef);
          }
          throw _createOrderError(error);
        }
      }
    } on Exception {
      rethrow;
    } catch (error) {
      throw AppException(AppErrorCode.orderCreateFailed, detail: '$error');
    }
  }

  /// Returns the two names it stored: the product's own.
  Future<({String productName, String companyName})> _placeOrder(
    Transaction transaction, {
    required _PlacementRead read,
    required DocumentReference<Map<String, dynamic>> productRef,
    required DocumentReference<Map<String, dynamic>> quotaRef,
    required DocumentReference<Map<String, dynamic>> orderRef,
    required OrderModel order,
    required Map<String, dynamic> orderData,
    required DocumentReference<Map<String, dynamic>> receiptRef,
    required Map<String, dynamic> receiptData,
    required DocumentReference<Map<String, dynamic>> chatRef,
  }) async {
    final productSnapshot = await transaction.get(productRef);
    final quotaSnapshot = await transaction.get(quotaRef);
    read.product = _version(productSnapshot.data(), _productVersionKeys);
    read.quota = _version(quotaSnapshot.data(), _quotaVersionKeys);

    // Every order is for a real product document of the order's own company;
    // the rules refuse any other (including the built-in demo catalogue,
    // which has none, and an id another company has since reused).
    if (!productSnapshot.exists ||
        productSnapshot.data()?['companyId'] != order.companyId) {
      throw StockUnavailableException(
        message: 'This product is no longer available.',
        available: 0,
        requested: order.quantity,
        productName: order.productName,
      );
    }

    final product = ProductModel.fromFirestore(productSnapshot);
    // A product without a price has nothing to charge, so it cannot be ordered
    // through checkout (the company may also have removed the price after the
    // customer opened the screen).
    if (!product.hasPrice) {
      throw AppException(
        AppErrorCode.orderProductNoPrice,
        productName: order.productName,
      );
    }
    // The price, a running offer or the installation price may have changed
    // since the customer saw the checkout. The rules refuse the old prices,
    // so say plainly that the price changed.
    if (!OrderPricing.matchesProduct(
      product: product,
      unitPrice: order.unitPrice,
      installationSelected: order.installationSelected,
      installationFee: order.installationFee,
    )) {
      throw AppException(
        AppErrorCode.orderPriceChanged,
        productName: order.productName,
      );
    }
    // The product must be able to cover the order now. Nothing is taken: the
    // stock is only checked here, and taken when the payment is confirmed.
    StockReservation.remainingAfter(
      available: product.isAvailable ? product.stockCount : 0,
      requested: order.quantity,
      productName: order.productName,
    );

    final quota = OrderQuotaModel.fromMap(quotaSnapshot.data());
    final nextOrderAt = quota.nextOrderAllowedAt(DateTime.now());
    if (nextOrderAt != null) {
      throw OrderQuotaReachedException(nextOrderAt: nextOrderAt);
    }

    // The names the order is stored under are the product's as it is now,
    // never the ones the checkout carried: the company may have renamed the
    // product since the customer opened it, and the rules accept only these.
    final productName = product.name;
    final companyName = product.companyName ?? '';
    transaction.set(orderRef, {
      ...orderData,
      'productName': productName,
      'companyName': companyName,
    });
    transaction.set(receiptRef, receiptData);
    final quotaStep = OrderQuotaModel.step(quota, orderRef.id);
    if (quotaSnapshot.exists) {
      transaction.update(quotaRef, quotaStep);
    } else {
      transaction.set(quotaRef, quotaStep);
    }
    transaction.set(
      chatRef,
      ChatModels.orderChatCreateMap(
        orderId: orderRef.id,
        customerId: order.customerId,
        companyId: order.companyId,
        customerName: order.customerName,
        companyName: companyName,
        productName: productName,
      ),
    );
    return (productName: productName, companyName: companyName);
  }

  /// Whether the product or the quota a refused placement read has changed
  /// since: then the refusal may come from that change (another order of the
  /// same customer took the quota slot, the company edited the product), and
  /// a fresh attempt will either succeed or say what changed. When neither
  /// changed, or they cannot be read, trying again would only be refused
  /// again.
  Future<bool> _changedSince(
    _PlacementRead read,
    DocumentReference<Map<String, dynamic>> productRef,
    DocumentReference<Map<String, dynamic>> quotaRef,
  ) async {
    try {
      final product = await productRef
          .get(const GetOptions(source: Source.server))
          .timeout(_reconciliationTimeout);
      final quota = await quotaRef
          .get(const GetOptions(source: Source.server))
          .timeout(_reconciliationTimeout);
      return !listEquals(
            _version(product.data(), _productVersionKeys),
            read.product,
          ) ||
          !listEquals(_version(quota.data(), _quotaVersionKeys), read.quota);
    } on TimeoutException {
      return false;
    } on FirebaseException {
      return false;
    }
  }

  /// Throws [OrderQuotaReachedException] when the customer's quota, read from
  /// the server now, allows no order. Returns normally otherwise, or when it
  /// cannot be read.
  Future<void> _throwIfQuotaReached(
    DocumentReference<Map<String, dynamic>> quotaRef,
  ) async {
    final DocumentSnapshot<Map<String, dynamic>> quota;
    try {
      quota = await quotaRef
          .get(const GetOptions(source: Source.server))
          .timeout(_reconciliationTimeout);
    } on TimeoutException {
      return;
    } on FirebaseException {
      return;
    }
    final nextOrderAt =
        OrderQuotaModel.fromMap(quota.data()).nextOrderAllowedAt(DateTime.now());
    if (nextOrderAt != null) {
      throw OrderQuotaReachedException(nextOrderAt: nextOrderAt);
    }
  }

  /// The values of [keys] in [data], or null when there is no document.
  static List<Object?>? _version(
    Map<String, dynamic>? data,
    List<String> keys,
  ) =>
      data == null ? null : [for (final key in keys) data[key]];

  /// A refusal by the rules, or a transaction that gave up after its reads
  /// kept changing: either may be a race that a fresh attempt settles.
  static bool _isRefusal(FirebaseException error) =>
      error.code == 'permission-denied' ||
      error.code == 'aborted' ||
      error.code == 'failed-precondition';

  /// The order stored at [docRef] when it is the one this app wrote as
  /// [written] (its acknowledgement was lost, or this is a retry of an order
  /// that went through), otherwise null. The two names are not compared:
  /// they are the product's, written by the transaction, and are read back
  /// from the stored order instead.
  Future<CreatedOrder?> _storedOrder(
    DocumentReference<Map<String, dynamic>> docRef,
    Map<String, dynamic> written,
  ) async {
    try {
      final snapshot = await docRef
          .get(const GetOptions(source: Source.server))
          .timeout(_reconciliationTimeout);
      final data = snapshot.data();
      if (!snapshot.exists || data == null) {
        return null;
      }
      final matches =
          _identifyingOrderKeys.every((key) => data[key] == written[key]);
      if (!matches) {
        return null;
      }
      return (
        id: docRef.id,
        productName: data['productName'] as String? ?? '',
        companyName: data['companyName'] as String? ?? '',
      );
    } on TimeoutException {
      return null;
    } on FirebaseException {
      return null;
    }
  }

  AppException _createOrderError(FirebaseException error) {
    switch (error.code) {
      case 'permission-denied':
        return const AppException(AppErrorCode.orderCreateDenied);
      case 'unavailable':
      case 'network-request-failed':
        return const AppException(AppErrorCode.orderCreateNetwork);
      default:
        return AppException(
          AppErrorCode.orderCreateFailed,
          detail: '${error.code}: ${error.message}',
        );
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
      throw AppException(
        AppErrorCode.orderAttachReceiptFailed,
        detail: '${error.code}: ${error.message}',
      );
    } catch (error) {
      throw AppException(
        AppErrorCode.orderAttachReceiptFailed,
        detail: '$error',
      );
    }
  }

  @override
  Future<OrderReceipt?> getReceipt(String orderId) async {
    try {
      final snapshot = await _firestore
          .collection(OrderReceiptModel.collection)
          .doc(orderId)
          .get();
      if (!snapshot.exists) return null;
      return OrderReceiptModel.fromMap(orderId, snapshot.data());
    } on FirebaseException catch (error) {
      throw AppException(
        AppErrorCode.orderReceiptLoadFailed,
        detail: '${error.code}: ${error.message}',
      );
    } catch (error) {
      throw AppException(AppErrorCode.orderReceiptLoadFailed, detail: '$error');
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
      throw AppException(
        AppErrorCode.orderFetchFailed,
        detail: '${error.code}: ${error.message}',
      );
    } catch (error) {
      throw AppException(AppErrorCode.orderFetchFailed, detail: '$error');
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
  Stream<OrderModel?> watchOrder(String orderId) {
    return _firestore
        .collection(_ordersCollection)
        .doc(orderId)
        .snapshots()
        .map((snapshot) => snapshot.exists && snapshot.data() != null
            ? OrderModel.fromFirestore(snapshot)
            : null);
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
      throw _companyUpdateError(
        error,
        AppErrorCode.orderUpdateStatusDenied,
        AppErrorCode.orderUpdateStatusFailed,
      );
    }
  }

  /// Confirms the order's payment and takes its stock in ONE transaction:
  /// the order is read, then its product. The order must still be Processing
  /// with its payment waiting, and the product must still exist, belong to
  /// the order's company and have at least the order's quantity. The product
  /// is lowered by exactly that quantity (recording the order in
  /// `lastOrderId`) in the same commit that marks the order confirmed with
  /// `stockReserved`. Nothing else on the order changes, its price included,
  /// even if the product's price has changed since. An order that already
  /// took its stock when it was placed (`stockReserved`, from before stock
  /// moved to the confirmation) is only marked confirmed.
  ///
  /// When the stock does not cover the order, nothing is written
  /// ([StockUnavailableException]): the order keeps waiting, to be confirmed
  /// after a restock or cancelled. The other refusals are
  /// [PaymentConfirmationException]s, also with nothing written.
  ///
  /// The rules let a payment be confirmed only while it is waiting, so no
  /// retry can take stock twice. A commit refused because another device
  /// confirmed or took stock in between is retried with fresh reads, which
  /// then confirm or say why not. A commit whose answer was lost is settled
  /// by reading the order back from the server: confirmed means it went
  /// through. Returns the order as the server stores it afterwards.
  @override
  Future<OrderModel> confirmPayment(String orderId) async {
    final orderRef = _firestore.collection(_ordersCollection).doc(orderId);
    // Set once an attempt may have been applied without the answer arriving:
    // from then on, finding the order confirmed means this call did it.
    var mayHaveApplied = false;
    var receiptChecked = false;
    for (var attempt = 1;; attempt++) {
      try {
        final committed = await _firestore
            .runTransaction(
              (transaction) => _confirmPayment(transaction, orderRef),
            )
            .timeout(_writeAcknowledgementTimeout);
        // Acknowledged by the server; read back what it stores.
        return await _serverOrder(orderRef) ?? committed;
      } on _AlreadyConfirmed catch (already) {
        if (mayHaveApplied) {
          return already.order;
        }
        throw const PaymentConfirmationException(
          PaymentConfirmationIssue.alreadyConfirmed,
        );
      } on TimeoutException {
        mayHaveApplied = true;
      } on FirebaseException catch (error) {
        if (_isRefusal(error)) {
          // Refused, so nothing was applied. A missing receipt is the one
          // refusal the transaction cannot see for itself (reading the
          // receipt would download its image on every confirmation).
          if (error.code == 'permission-denied' && !receiptChecked) {
            receiptChecked = true;
            await _throwIfNoReceipt(orderId);
          }
          if (attempt >= _maxAttempts) {
            throw _companyUpdateError(
              error,
              AppErrorCode.orderConfirmPaymentDenied,
              AppErrorCode.orderConfirmPaymentFailed,
            );
          }
          continue; // fresh reads: confirm, or say what changed
        }
        mayHaveApplied = true;
      }
      // The answer was lost: the commit may or may not have been applied.
      final stored = await _serverOrder(orderRef);
      if (stored != null && stored.paymentStatus == PaymentStatus.confirmed) {
        return stored;
      }
      if (stored == null || attempt >= _maxAttempts) {
        throw const AppException(
          AppErrorCode.orderConfirmPaymentFailed,
          detail: 'the confirmation was sent but its answer did not arrive',
        );
      }
      // Still waiting: it was not applied. Try again; if the first commit
      // lands meanwhile, the next read finds the order confirmed.
    }
  }

  /// The transaction of [confirmPayment]; returns the order as confirmed.
  Future<OrderModel> _confirmPayment(
    Transaction transaction,
    DocumentReference<Map<String, dynamic>> orderRef,
  ) async {
    final snapshot = await transaction.get(orderRef);
    final data = snapshot.data();
    if (!snapshot.exists || data == null) {
      throw const PaymentConfirmationException(
        PaymentConfirmationIssue.notAwaitingPayment,
      );
    }
    final order = OrderModel.fromFirestore(snapshot);
    if (data['paymentStatus'] == PaymentStatus.confirmed.value) {
      throw _AlreadyConfirmed(order);
    }
    // The stored values, exactly as the rules compare them.
    if (data['orderStatus'] != OrderStatus.processing.value ||
        data['paymentStatus'] != PaymentStatus.pendingVerification.value) {
      throw const PaymentConfirmationException(
        PaymentConfirmationIssue.notAwaitingPayment,
      );
    }
    final confirmed = {
      'paymentStatus': PaymentStatus.confirmed.value,
      'updatedAt': FieldValue.serverTimestamp(),
    };
    if (order.stockReserved) {
      // Placed before stock moved to the confirmation: it already took its
      // stock then, so only the payment changes.
      transaction.update(orderRef, confirmed);
      return OrderModel.fromMap(
        {...data, 'paymentStatus': PaymentStatus.confirmed.value},
        snapshot.id,
      );
    }
    final productRef =
        _firestore.collection(_productsCollection).doc(order.productId);
    final productSnapshot = await transaction.get(productRef);
    final product = productSnapshot.data();
    if (!productSnapshot.exists ||
        product == null ||
        product['companyId'] != order.companyId) {
      throw StockUnavailableException(
        message: 'This product is no longer available.',
        available: 0,
        requested: order.quantity,
        productName: order.productName,
      );
    }
    final stock = product['stockCount'];
    final remaining = StockReservation.remainingAfter(
      // The rules count only a whole number as stock.
      available: stock is int ? stock : 0,
      requested: order.quantity,
      productName: order.productName,
    );
    transaction.update(productRef, {
      'stockCount': remaining,
      'lastOrderId': orderRef.id,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    transaction.update(orderRef, {...confirmed, 'stockReserved': true});
    return OrderModel.fromMap(
      {
        ...data,
        'paymentStatus': PaymentStatus.confirmed.value,
        'stockReserved': true,
      },
      snapshot.id,
    );
  }

  /// Throws [PaymentConfirmationIssue.noReceipt] when [orderId] has no stored
  /// receipt. Returns normally when it has one, or when that cannot be told.
  Future<void> _throwIfNoReceipt(String orderId) async {
    final DocumentSnapshot<Map<String, dynamic>> receipt;
    try {
      receipt = await _firestore
          .collection(OrderReceiptModel.collection)
          .doc(orderId)
          .get(const GetOptions(source: Source.server))
          .timeout(_reconciliationTimeout);
    } on TimeoutException {
      return;
    } on FirebaseException {
      return;
    }
    if (!receipt.exists) {
      throw const PaymentConfirmationException(
        PaymentConfirmationIssue.noReceipt,
      );
    }
  }

  /// The order as the server stores it now; null when it cannot be read.
  Future<OrderModel?> _serverOrder(
    DocumentReference<Map<String, dynamic>> orderRef,
  ) async {
    try {
      final snapshot = await orderRef
          .get(const GetOptions(source: Source.server))
          .timeout(_reconciliationTimeout);
      return snapshot.exists && snapshot.data() != null
          ? OrderModel.fromFirestore(snapshot)
          : null;
    } on TimeoutException {
      return null;
    } on FirebaseException {
      return null;
    }
  }

  /// Cancels the order, and gives back its stock if it took some, in ONE
  /// transaction: the order is re-read, so one that meanwhile moved on or was
  /// already cancelled is refused, and stock can never go back twice.
  ///
  /// The company may cancel while the order is Processing, with its payment
  /// waiting or already confirmed (the refund then happens outside the app).
  /// The reasons are limited as in the rules: [OrderCancelReason.expired]
  /// and [OrderCancelReason.outOfStock] only while the payment is waiting,
  /// and out of stock only when the product can no longer cover the order
  /// (gone, now another company's, or too few units), else
  /// [ProductStillCoversOrderException].
  ///
  /// Stock goes back only for an order that took it
  /// ([OrderEntity.stockReserved]), to a product that still exists and still
  /// belongs to the order's company (never one another company created later
  /// under the same id). Any other order is cancelled without touching stock.
  /// The security rules enforce all of this too.
  @override
  Future<void> cancelOrder({
    required String orderId,
    required OrderCancelReason reason,
  }) async {
    final orderRef = _firestore.collection(_ordersCollection).doc(orderId);
    try {
      await _firestore.runTransaction((transaction) async {
        final snapshot = await transaction.get(orderRef);
        final data = snapshot.data();
        if (!snapshot.exists || data == null) {
          throw const AppException(AppErrorCode.orderCancelNotAllowed);
        }
        final order = OrderModel.fromFirestore(snapshot);
        // The stored values, exactly as the rules compare them.
        final paymentWaiting =
            data['paymentStatus'] == PaymentStatus.pendingVerification.value;
        final cancellable =
            data['orderStatus'] == OrderStatus.processing.value &&
                (paymentWaiting ||
                    data['paymentStatus'] == PaymentStatus.confirmed.value);
        final reasonAllowed = reason == OrderCancelReason.company ||
            paymentWaiting;
        if (!cancellable || !reasonAllowed) {
          throw const AppException(AppErrorCode.orderCancelNotAllowed);
        }
        final productRef =
            _firestore.collection(_productsCollection).doc(order.productId);
        final needsProduct =
            order.stockReserved || reason == OrderCancelReason.outOfStock;
        final product =
            needsProduct ? (await transaction.get(productRef)).data() : null;
        // Only the order's own company's product counts.
        final sameCompany =
            product != null && product['companyId'] == order.companyId;
        final stock = product?['stockCount'];
        if (reason == OrderCancelReason.outOfStock &&
            sameCompany &&
            stock is int &&
            stock >= order.quantity) {
          throw ProductStillCoversOrderException(
            available: stock,
            requested: order.quantity,
          );
        }
        var stockReleased = false;
        if (order.stockReserved && sameCompany && stock is num) {
          transaction.update(productRef, {
            'stockCount': stock.toInt() + order.quantity,
            'lastReleasedOrderId': orderId,
            'updatedAt': FieldValue.serverTimestamp(),
          });
          stockReleased = true;
        }
        transaction.update(orderRef, {
          'orderStatus': OrderStatus.cancelled.value,
          'cancelReason': reason.value,
          'cancelledAt': FieldValue.serverTimestamp(),
          'stockReleased': stockReleased,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      });
    } on FirebaseException catch (error) {
      throw _companyUpdateError(
        error,
        AppErrorCode.orderCancelDenied,
        AppErrorCode.orderCancelFailed,
      );
    }
  }

  /// Cancels as expired each of the company's orders whose payment was not
  /// verified within [OrderEntity.paymentVerificationWindow]. Only orders
  /// still waiting for verification are candidates: a confirmed order never
  /// expires. The phone's clock only picks which orders to try: the security
  /// rules decide with the server's clock, so an order refused as "not yet
  /// expired" simply stays and is tried again the next time. An order that
  /// took no stock (every order placed since stock moved to the payment
  /// confirmation) gives none back. Never throws.
  @override
  Future<int> expireOverdueOrders(String companyId) async {
    final List<OrderModel> waiting;
    try {
      final snapshot = await _firestore
          .collection(_ordersCollection)
          .where('companyId', isEqualTo: companyId)
          .where('orderStatus', isEqualTo: OrderStatus.processing.value)
          .where('paymentStatus', isEqualTo: PaymentStatus.pendingVerification.value)
          .get();
      waiting = snapshot.docs.map(OrderModel.fromFirestore).toList();
    } on Exception {
      return 0;
    }
    final now = DateTime.now();
    var expired = 0;
    for (final order in waiting) {
      if (!order.toEntity().isPaymentVerificationOverdue(now)) {
        continue;
      }
      try {
        await cancelOrder(orderId: order.id, reason: OrderCancelReason.expired);
        expired++;
      } on Exception {
        // Not expired by the server's clock yet, or changed meanwhile.
      }
    }
    return expired;
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
      // The rules refuse a write that changes nothing. When the order already
      // has exactly this technician (a second tap, or another device), the
      // assignment is done: there is nothing to report.
      if (error.code == 'permission-denied') {
        final order = await _serverOrder(
          _firestore.collection(_ordersCollection).doc(orderId),
        );
        if (order != null &&
            order.technicianId == technicianId &&
            order.technicianName == technicianName) {
          return;
        }
      }
      throw _companyUpdateError(
        error,
        AppErrorCode.orderAssignTechnicianDenied,
        AppErrorCode.orderAssignTechnicianFailed,
      );
    }
  }

  @override
  Future<void> startChat({
    required String orderId,
    required String customerId,
    required String companyId,
    required String customerName,
    required String companyName,
    required String productName,
  }) async {
    try {
      await _firestore.collection(_chatsCollection).doc(orderId).set(
            ChatModels.orderChatCreateMap(
              orderId: orderId,
              customerId: customerId,
              companyId: companyId,
              customerName: customerName,
              companyName: companyName,
              productName: productName,
            ),
          );
    } on FirebaseException catch (error) {
      // Somebody else already opened it (a race with another tap, or the
      // order already had one): nothing to do.
      if (error.code == 'permission-denied') return;
      throw AppException(AppErrorCode.chatStartFailed, detail: error.code);
    }
  }

  AppException _companyUpdateError(
    FirebaseException error,
    AppErrorCode denied,
    AppErrorCode failed,
  ) {
    if (error.code == 'permission-denied') {
      return AppException(denied);
    }
    return AppException(failed, detail: '${error.code}: ${error.message}');
  }
}

/// What one placement attempt read, so that a refused commit can be told
/// apart: worth another attempt only if the product or the quota changed
/// since (see [FirestoreOrdersRemoteDataSource._changedSince]).
class _PlacementRead {
  List<Object?>? product;
  List<Object?>? quota;
}

/// The order a confirmation read is already confirmed: success when an
/// earlier attempt of the same call may have done it, otherwise a refusal.
class _AlreadyConfirmed implements Exception {
  const _AlreadyConfirmed(this.order);

  final OrderModel order;
}
