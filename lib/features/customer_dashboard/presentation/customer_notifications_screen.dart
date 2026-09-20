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
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.commonNotifications)),
      body: notificationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline_rounded,
                    size: 48, color: colorScheme.error),
                const SizedBox(height: 12),
                Text(context.l10n.notificationsLoadFailed),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: () => ref
                      .invalidate(customerNotificationsStreamProvider(customerId)),
                  child: Text(context.l10n.commonRetry),
                ),
              ],
            ),
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.notifications_none_outlined,
                      size: 48,
                      color: colorScheme.onSurface.withValues(alpha: 0.35),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      context.l10n.notificationsEmpty,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: colorScheme.onSurface.withValues(alpha: 0.6),
                          ),
                    ),
                  ],
                ),
              ),
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
