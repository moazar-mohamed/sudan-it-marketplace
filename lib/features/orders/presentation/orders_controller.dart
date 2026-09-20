import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/error_messages.dart';
import '../../../core/localization/locale_controller.dart';
import '../../notifications/presentation/notification_events.dart';
import '../../notifications/presentation/notifications_providers.dart';
import '../../products/domain/stock_reservation.dart';
import '../../products/presentation/stock_error_message.dart';
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
    double? deliveryLatitude,
    double? deliveryLongitude,
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
        deliveryLatitude: deliveryLatitude,
        deliveryLongitude: deliveryLongitude,
      );
      state = OrderActionSuccess(order);
      final notifications = ref.read(notificationsRepositoryProvider);
      await notifications.createNotification(
        NotificationEvents.newOrder(
          id: notifications.newNotificationId(),
          orderId: order.id,
          companyId: order.companyId,
          productName: order.productName,
        ),
      );
      return order;
    } catch (e) {
      state = OrderActionError(_errorMessage(e));
      return null;
    }
  }

  String _errorMessage(Object error) {
    final l10n = ref.read(appLocalizationsProvider);
    if (error is StockUnavailableException) {
      return stockErrorMessage(l10n, error);
    }
    return localizedErrorMessage(l10n, error);
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
      state = OrderActionError(_errorMessage(e));
      return false;
    }
  }
}
