import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/order_entity.dart';
import '../domain/repositories/orders_repository.dart';
import 'orders_providers.dart';

sealed class OrderActionState {
  const OrderActionState();
}

class OrderActionInitial extends OrderActionState {
  const OrderActionInitial();
}

class OrderActionLoading extends OrderActionState {
  const OrderActionLoading();
}

class OrderActionSuccess extends OrderActionState {
  const OrderActionSuccess(this.order);
  final OrderEntity order;
}

class OrderActionError extends OrderActionState {
  const OrderActionError(this.message);
  final String message;
}

final ordersControllerProvider =
    NotifierProvider<OrdersController, OrderActionState>(OrdersController.new);

class OrdersController extends Notifier<OrderActionState> {
  OrdersRepository get _repository => ref.read(ordersRepositoryProvider);

  @override
  OrderActionState build() => const OrderActionInitial();

  Future<OrderEntity?> createOrder({
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
  }) async {
    state = const OrderActionLoading();
    try {
      final order = await _repository.createOrder(
        orderId: orderId,
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
        receiptFileName: receiptFileName,
      );
      state = OrderActionSuccess(order);
      return order;
    } catch (e) {
      state = OrderActionError(_errorMessage(e));
      return null;
    }
  }

  String _errorMessage(Object error) {
    final message = error.toString();
    return message.startsWith('Exception: ')
        ? message.substring('Exception: '.length)
        : message;
  }

  Future<bool> attachReceipt({
    required String orderId,
    required String receiptFileName,
  }) async {
    state = const OrderActionLoading();
    try {
      await _repository.attachReceipt(
        orderId: orderId,
        receiptFileName: receiptFileName,
      );
      return true;
    } catch (e) {
      state = OrderActionError(e.toString());
      return false;
    }
  }
}
