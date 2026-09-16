import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../orders/domain/entities/order_entity.dart';
import '../../orders/presentation/orders_providers.dart';

final technicianActionsProvider = Provider<TechnicianActions>((ref) {
  return TechnicianActions(ref);
});

/// Write operations used by the Technician screens. Each method returns
/// null on success or a user-facing error message.
class TechnicianActions {
  TechnicianActions(this._ref);

  final Ref _ref;

  Future<String?> advanceJobStatus(OrderEntity order, OrderStatus status) {
    return _guard(
      () => _ref.read(ordersRepositoryProvider).updateOrderStatus(
            orderId: order.id,
            orderStatus: status,
          ),
    );
  }

  Future<String?> _guard(Future<void> Function() action) async {
    try {
      await action();
      return null;
    } catch (error) {
      final message = error.toString();
      return message.startsWith('Exception: ')
          ? message.substring('Exception: '.length)
          : message;
    }
  }
}
