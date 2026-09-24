import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/auth_state.dart';
import '../../notifications/presentation/notifications_providers.dart';
import '../../notifications/presentation/widgets/notification_tile.dart';
import '../../orders/domain/entities/order_entity.dart';
import '../../orders/presentation/order_details_screen.dart';
import '../../orders/presentation/orders_providers.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../../core/widgets/app_widgets.dart';

OrderEntity? _findOrder(List<OrderEntity>? orders, String orderId) {
  for (final order in orders ?? const <OrderEntity>[]) {
    if (order.id == orderId) {
      return order;
    }
  }
  return null;
}

class CustomerNotificationsScreen extends ConsumerWidget {
  const CustomerNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final customerId = switch (authState) {
      AuthAuthenticated(:final user) => user.id,
      _ => FirebaseAuth.instance.currentUser?.uid ?? '',
    };
    final notificationsAsync =
        ref.watch(customerNotificationsStreamProvider(customerId));
    final ordersAsync = ref.watch(customerOrdersStreamProvider);

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.commonNotifications)),
      body: notificationsAsync.when(
        loading: () => const AppLoadingState(),
        error: (_, _) => AppErrorState(
          message: context.l10n.notificationsLoadFailed,
          onRetry: () =>
              ref.invalidate(customerNotificationsStreamProvider(customerId)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return AppEmptyState(
              icon: Icons.notifications_none_outlined,
              message: context.l10n.notificationsEmpty,
              expandVertically: true,
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: items.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final notification = items[index];
              return NotificationTile(
                notification: notification,
                onTap: () {
                  if (!notification.isRead) {
                    ref
                        .read(notificationsRepositoryProvider)
                        .markAsRead(notification.id);
                  }
                  final order =
                      _findOrder(ordersAsync.asData?.value, notification.orderId);
                  if (order != null) {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => OrderDetailsScreen(order: order),
                      ),
                    );
                  }
                },
              );
            },
          );
        },
      ),
    );
  }
}
