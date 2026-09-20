import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../domain/entities/app_notification.dart';
import '../notification_format.dart';

class NotificationTile extends StatelessWidget {
  const NotificationTile({
    super.key,
    required this.notification,
    required this.onTap,
  });

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final style = NotificationFormat.style(notification, colorScheme);

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: style.color.withValues(alpha: 0.12),
        foregroundColor: style.color,
        child: Icon(style.icon),
      ),
      title: Text(
        NotificationFormat.title(context.l10n, notification),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: textTheme.bodyMedium?.copyWith(
          fontWeight: notification.isRead ? FontWeight.w600 : FontWeight.w800,
        ),
      ),
      subtitle: Text(
        '${NotificationFormat.body(context.l10n, notification)}\n${NotificationFormat.date(notification.createdAt)}',
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
      ),
      isThreeLine: true,
      trailing: notification.isRead
          ? null
          : Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: colorScheme.primary,
                shape: BoxShape.circle,
              ),
            ),
      onTap: onTap,
    );
  }
}
