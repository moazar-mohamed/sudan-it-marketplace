import '../../reports/presentation/my_reports_screen.dart';

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
import '../../service_requests/presentation/service_request_details_screen.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../notifications/domain/entities/app_notification.dart';
import 'site/site_look.dart';
import 'site/site_orders.dart';

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
    final notificationsAsync = ref.watch(
      customerNotificationsStreamProvider(customerId),
    );
    final ordersAsync = ref.watch(customerOrdersStreamProvider);

    return Scaffold(
      appBar: AppBar(),
      body: notificationsAsync.when(
        loading: () => const AppLoadingState(),
        error: (_, _) => AppErrorState(
          message: context.l10n.notificationsLoadFailed,
          onRetry: () =>
              ref.invalidate(customerNotificationsStreamProvider(customerId)),
        ),
        // As on sictm.net: the title, then the notifications in one rounded
        // block (`.rows`), the unread ones on the grey fill.
        data: (items) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
          children: [
            SitePageTitle(context.l10n.commonNotifications),
            const SizedBox(height: 16),
            if (items.isEmpty)
              SiteEmptyState(title: context.l10n.notificationsEmpty)
            else
              _rows(context, ref, items, ordersAsync),
          ],
        ),
      ),
    );
  }

  Widget _rows(
    BuildContext context,
    WidgetRef ref,
    List<AppNotification> items,
    AsyncValue<List<OrderEntity>> ordersAsync,
  ) {
    final colors = context.colors;
    return Container(
      key: const ValueKey('notification-rows'),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            if (index > 0) Divider(height: 1, color: colors.borderDefault),
            Builder(
              builder: (context) {
                final notification = items[index];
                return NotificationTile(
                  notification: notification,
                  onDelete: () => ref
                      .read(notificationsRepositoryProvider)
                      .deleteNotification(notification.id),
                  onTap: () {
                    if (!notification.isRead) {
                      ref
                          .read(notificationsRepositoryProvider)
                          .markAsRead(notification.id);
                    }
                    if (notification.reportId.isNotEmpty) {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const MyReportsScreen(),
                        ),
                      );
                      return;
                    }
                    if (notification.serviceRequestId.isNotEmpty) {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ServiceRequestDetailsScreen(
                            requestId: notification.serviceRequestId,
                            asCompany: false,
                          ),
                        ),
                      );
                      return;
                    }
                    final order = _findOrder(
                      ordersAsync.asData?.value,
                      notification.orderId,
                    );
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
            ),
          ],
        ],
      ),
    );
  }
}
