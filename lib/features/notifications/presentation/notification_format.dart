import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../domain/entities/app_notification.dart';

class NotificationFormat {
  NotificationFormat._();

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
