import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/entities/app_notification.dart';

class NotificationFormat {
  NotificationFormat._();

  /// The title in the reader's language. Unknown types keep the stored text.
  static String title(AppLocalizations l10n, AppNotification notification) {
    return switch (notification.type) {
      'new_order' => l10n.notifNewOrderTitle,
      'payment_confirmed' => l10n.notifPaymentConfirmedTitle,
      'out_for_delivery' => l10n.notifOutForDeliveryTitle,
      'order_completed' => l10n.notifOrderCompletedTitle,
      'technician_assigned' => l10n.notifTechnicianAssignedTitle,
      _ => notification.title,
    };
  }

  /// The body in the reader's language. The product name is the quoted part
  /// of the stored body; when it cannot be found the stored text is shown.
  static String body(AppLocalizations l10n, AppNotification notification) {
    final product = _quotedName(notification.body);
    return switch (notification.type) {
      'new_order' when product != null => l10n.notifNewOrderBody(product),
      'payment_confirmed' when product != null =>
        l10n.notifPaymentConfirmedBody(product),
      'out_for_delivery' when product != null =>
        l10n.notifOutForDeliveryBody(product),
      'order_completed' => l10n.notifOrderCompletedBody,
      'technician_assigned' when product != null =>
        l10n.notifTechnicianAssignedBody(product),
      _ => notification.body,
    };
  }

  static String? _quotedName(String body) =>
      RegExp(r'"(.*)"').firstMatch(body)?.group(1);

  static String date(DateTime value) {
    final local = value.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${local.year}-${two(local.month)}-${two(local.day)} '
        '${two(local.hour)}:${two(local.minute)}';
  }

  static ({IconData icon, Color color}) style(
    AppNotification notification,
    ColorScheme colorScheme,
  ) {
    return switch (notification.type) {
      'new_order' => (
          icon: Icons.receipt_long_outlined,
          color: colorScheme.primary,
        ),
      'payment_confirmed' => (
          icon: Icons.verified_outlined,
          color: AppColors.success,
        ),
      'out_for_delivery' => (
          icon: Icons.local_shipping_outlined,
          color: Colors.deepOrange,
        ),
      'order_completed' => (
          icon: Icons.check_circle_outline,
          color: Colors.green,
        ),
      'technician_assigned' => (
          icon: Icons.engineering_outlined,
          color: colorScheme.primary,
        ),
      _ => (icon: Icons.notifications_outlined, color: colorScheme.primary),
    };
  }
}
