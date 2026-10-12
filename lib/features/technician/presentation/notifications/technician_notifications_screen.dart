import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../notifications/domain/entities/app_notification.dart';
import '../../../notifications/presentation/notifications_providers.dart';
import '../../../notifications/presentation/widgets/notification_tile.dart';
import '../jobs/technician_job_details_screen.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
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
    final items = notificationsAsync.asData?.value ?? const <AppNotification>[];
    final unread = items.where((n) => !n.isRead).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.commonNotifications),
        actions: [
          if (unread.isNotEmpty)
            TextButton(
              key: const ValueKey('technician-mark-all-read'),
              onPressed: () {
                final repository = ref.read(notificationsRepositoryProvider);
                for (final notification in unread) {
                  repository.markAsRead(notification.id).catchError((_) {});
                }
              },
              child: Text(context.l10n.tjMarkAllRead),
            ),
        ],
      ),
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
          final now = DateTime.now();
          bool isToday(AppNotification n) {
            final at = n.createdAt.toLocal();
            return at.year == now.year &&
                at.month == now.month &&
                at.day == now.day;
          }

          final today = items.where(isToday).toList();
          final earlier = items.where((n) => !isToday(n)).toList();

          Widget header(String title) => Container(
                width: double.infinity,
                color: context.colors.bgMuted,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.s16,
                  vertical: AppSpacing.s8,
                ),
                child: Text(
                  title,
                  style: AppTextStyles.captionStrong
                      .copyWith(color: context.colors.textSecondary),
                ),
              );

          Widget tile(AppNotification notification) => NotificationTile(
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

          return ListView(
            padding: const EdgeInsets.only(bottom: AppSpacing.s16),
            children: [
              if (today.isNotEmpty) ...[
                header(context.l10n.tjNotifToday),
                for (final n in today) ...[tile(n), const Divider(height: 1)],
              ],
              if (earlier.isNotEmpty) ...[
                header(context.l10n.tjNotifEarlier),
                for (final n in earlier) ...[tile(n), const Divider(height: 1)],
              ],
            ],
          );
        },
      ),
    );
  }
}
