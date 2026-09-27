import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/error_messages.dart';
import '../../../core/localization/locale_controller.dart';
import '../domain/entities/order_entity.dart';
import 'orders_providers.dart';

final orderChatActionsProvider =
    Provider<OrderChatActions>((ref) => OrderChatActions(ref));

/// Opens the conversation with an order's company, for an order placed
/// before every order got one automatically.
class OrderChatActions {
  OrderChatActions(this._ref);

  final Ref _ref;

  /// Returns null on success (the conversation now exists, under the order's
  /// own id), or a user-facing error message.
  Future<String?> start(OrderEntity order) async {
    try {
      await _ref.read(ordersRepositoryProvider).startChat(order);
      return null;
    } catch (error) {
      return localizedErrorMessage(_ref.read(appLocalizationsProvider), error);
    }
  }
}
