import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
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
    final style = NotificationFormat.style(notification);
    final unread = !notification.isRead;

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s16,
        vertical: AppSpacing.s4,
      ),
      leading: AppIconTile(
        icon: style.icon,
        tone: style.tone,
        size: 40,
        radius: AppRadius.full,
      ),
      title: Text(
        NotificationFormat.title(context.l10n, notification),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.bodyStrong.copyWith(
          fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
      subtitle: Text(
        '${NotificationFormat.body(context.l10n, notification)}\n${NotificationFormat.date(notification.createdAt)}',
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
      ),
      isThreeLine: true,
      // The dot is decoration; the bold title carries "unread" for readers
      // that do not see colour.
      trailing: unread ? const AppUnreadDot() : null,
      onTap: onTap,
    );
  }
}
