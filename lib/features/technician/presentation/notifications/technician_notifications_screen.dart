import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../notifications/presentation/notifications_providers.dart';
import '../../../notifications/presentation/widgets/notification_tile.dart';
import '../jobs/technician_job_details_screen.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../widgets/technician_widgets.dart';
import '../../../../core/localization/l10n_extension.dart';

class TechnicianNotificationsScreen extends ConsumerWidget {
  const TechnicianNotificationsScreen({super.key, required this.technicianId});

  final String technicianId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync =
        ref.watch(technicianNotificationsStreamProvider(technicianId));

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.commonNotifications)),
      body: notificationsAsync.when(
        loading: () => const AppLoadingState(),
        error: (_, _) => TechnicianErrorState(
          message: context.l10n.notificationsLoadFailed,
          onRetry: () => ref
              .invalidate(technicianNotificationsStreamProvider(technicianId)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return ListView(
              children: [
                TechnicianEmptyState(
                  icon: Icons.notifications_none_outlined,
                  message: context.l10n.notificationsEmpty,
                ),
              ],
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
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => TechnicianJobDetailsScreen(
                        technicianId: technicianId,
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
