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
      'new_review' => l10n.notifNewReviewTitle,
      'review_reply' => l10n.notifReviewReplyTitle,
      'new_service_request' => l10n.notifNewServiceRequestTitle,
      'service_request_accepted' => l10n.notifServiceRequestAcceptedTitle,
      'service_request_rejected' => l10n.notifServiceRequestRejectedTitle,
      'service_request_in_progress' => l10n.notifServiceRequestInProgressTitle,
      'service_request_completed' => l10n.notifServiceRequestCompletedTitle,
      'service_request_cancelled' => l10n.notifServiceRequestCancelledTitle,
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
      'new_review' when product != null => l10n.notifNewReviewBody(product),
      'review_reply' when product != null =>
        l10n.notifReviewReplyBody(product),
      'new_service_request' when product != null =>
        l10n.notifNewServiceRequestBody(product),
      'service_request_accepted' when product != null =>
        l10n.notifServiceRequestAcceptedBody(product),
      'service_request_rejected' when product != null =>
        l10n.notifServiceRequestRejectedBody(product),
      'service_request_in_progress' when product != null =>
        l10n.notifServiceRequestInProgressBody(product),
      'service_request_completed' when product != null =>
        l10n.notifServiceRequestCompletedBody(product),
      'service_request_cancelled' when product != null =>
        l10n.notifServiceRequestCancelledBody(product),
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

  static ({IconData icon, AppTone tone}) style(AppNotification notification) {
    return switch (notification.type) {
      'new_order' => (icon: Icons.receipt_long_outlined, tone: AppTone.brand),
      'payment_confirmed' => (
          icon: Icons.verified_outlined,
          tone: AppTone.success,
        ),
      'out_for_delivery' => (
          icon: Icons.local_shipping_outlined,
          tone: AppTone.progress,
        ),
      'order_completed' => (
          icon: Icons.check_circle_outline,
          tone: AppTone.success,
        ),
      'technician_assigned' => (
          icon: Icons.engineering_outlined,
          tone: AppTone.brand,
        ),
      'new_review' => (icon: Icons.star_outline_rounded, tone: AppTone.warning),
      'review_reply' => (icon: Icons.reply_rounded, tone: AppTone.brand),
      'new_service_request' => (
          icon: Icons.build_circle_outlined,
          tone: AppTone.brand,
        ),
      'service_request_accepted' => (
          icon: Icons.thumb_up_alt_outlined,
          tone: AppTone.info,
        ),
      'service_request_rejected' => (
          icon: Icons.block_outlined,
          tone: AppTone.error,
        ),
      'service_request_in_progress' => (
          icon: Icons.engineering_outlined,
          tone: AppTone.progress,
        ),
      'service_request_completed' => (
          icon: Icons.check_circle_outline,
          tone: AppTone.success,
        ),
      'service_request_cancelled' => (
          icon: Icons.cancel_outlined,
          tone: AppTone.neutral,
        ),
      _ => (icon: Icons.notifications_outlined, tone: AppTone.brand),
    };
  }
}
