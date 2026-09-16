import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../notifications/presentation/notifications_providers.dart';
import '../../../notifications/presentation/widgets/notification_tile.dart';
import '../orders/company_order_details_screen.dart';
import '../widgets/admin_section_card.dart';

class CompanyNotificationsScreen extends ConsumerWidget {
  const CompanyNotificationsScreen({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync =
        ref.watch(companyNotificationsStreamProvider(companyId));

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: notificationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => AdminErrorState(
          message: 'Could not load notifications.',
          onRetry: () =>
              ref.invalidate(companyNotificationsStreamProvider(companyId)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return ListView(
              children: const [
                AdminEmptyState(
                  icon: Icons.notifications_none_outlined,
                  message: 'No notifications yet.',
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
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
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => CompanyOrderDetailsScreen(
                        companyId: companyId,
                        orderId: notification.orderId,
                      ),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}
