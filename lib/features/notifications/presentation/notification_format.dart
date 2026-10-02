import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/entities/app_notification.dart';
import 'notification_events.dart';

/// The words and look of a notification, built only from its type and its
/// product name, in the reader's language. Nothing a sender wrote is shown:
/// an unknown type gets a plain, general message.
class NotificationFormat {
  NotificationFormat._();

  static String title(AppLocalizations l10n, AppNotification notification) {
    return switch (notification.type) {
      NotificationTypes.newOrder => l10n.notifNewOrderTitle,
      NotificationTypes.paymentConfirmed => l10n.notifPaymentConfirmedTitle,
      NotificationTypes.outForDelivery => l10n.notifOutForDeliveryTitle,
      NotificationTypes.orderCompleted => l10n.notifOrderCompletedTitle,
      NotificationTypes.technicianAssigned =>
        l10n.notifTechnicianAssignedTitle,
      NotificationTypes.newReview => l10n.notifNewReviewTitle,
      NotificationTypes.reviewReply => l10n.notifReviewReplyTitle,
      NotificationTypes.newServiceRequest =>
        l10n.notifNewServiceRequestTitle,
      NotificationTypes.serviceRequestAccepted =>
        l10n.notifServiceRequestAcceptedTitle,
      NotificationTypes.serviceRequestRejected =>
        l10n.notifServiceRequestRejectedTitle,
      NotificationTypes.serviceRequestInProgress =>
        l10n.notifServiceRequestInProgressTitle,
      NotificationTypes.serviceRequestCompleted =>
        l10n.notifServiceRequestCompletedTitle,
      NotificationTypes.serviceRequestCancelled =>
        l10n.notifServiceRequestCancelledTitle,
      _ => l10n.notifGenericTitle,
    };
  }

  /// A notification stored without a product name (before names were kept
  /// apart) gets the general message under its own title.
  static String body(AppLocalizations l10n, AppNotification notification) {
    final product = notification.productName.trim();
    final named = product.isNotEmpty;
    return switch (notification.type) {
      NotificationTypes.newOrder when named => l10n.notifNewOrderBody(product),
      NotificationTypes.paymentConfirmed when named =>
        l10n.notifPaymentConfirmedBody(product),
      NotificationTypes.outForDelivery when named =>
        l10n.notifOutForDeliveryBody(product),
      NotificationTypes.orderCompleted => l10n.notifOrderCompletedBody,
      NotificationTypes.technicianAssigned when named =>
        l10n.notifTechnicianAssignedBody(product),
      NotificationTypes.newReview when named =>
        l10n.notifNewReviewBody(product),
      NotificationTypes.reviewReply when named =>
        l10n.notifReviewReplyBody(product),
      NotificationTypes.newServiceRequest when named =>
        l10n.notifNewServiceRequestBody(product),
      NotificationTypes.serviceRequestAccepted when named =>
        l10n.notifServiceRequestAcceptedBody(product),
      NotificationTypes.serviceRequestRejected when named =>
        l10n.notifServiceRequestRejectedBody(product),
      NotificationTypes.serviceRequestInProgress when named =>
        l10n.notifServiceRequestInProgressBody(product),
      NotificationTypes.serviceRequestCompleted when named =>
        l10n.notifServiceRequestCompletedBody(product),
      NotificationTypes.serviceRequestCancelled when named =>
        l10n.notifServiceRequestCancelledBody(product),
      _ => l10n.notifGenericBody,
    };
  }

  static String date(DateTime value) {
    final local = value.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${local.year}-${two(local.month)}-${two(local.day)} '
        '${two(local.hour)}:${two(local.minute)}';
  }

  static ({IconData icon, AppTone tone}) style(AppNotification notification) {
    return switch (notification.type) {
      NotificationTypes.newOrder => (
          icon: Icons.receipt_long_outlined,
          tone: AppTone.brand,
        ),
      NotificationTypes.paymentConfirmed => (
          icon: Icons.verified_outlined,
          tone: AppTone.success,
        ),
      NotificationTypes.outForDelivery => (
          icon: Icons.local_shipping_outlined,
          tone: AppTone.progress,
        ),
      NotificationTypes.orderCompleted => (
          icon: Icons.check_circle_outline,
          tone: AppTone.success,
        ),
      NotificationTypes.technicianAssigned => (
          icon: Icons.engineering_outlined,
          tone: AppTone.brand,
        ),
      NotificationTypes.newReview => (
          icon: Icons.star_outline_rounded,
          tone: AppTone.warning,
        ),
      NotificationTypes.reviewReply => (
          icon: Icons.reply_rounded,
          tone: AppTone.brand,
        ),
      NotificationTypes.newServiceRequest => (
          icon: Icons.build_circle_outlined,
          tone: AppTone.brand,
        ),
      NotificationTypes.serviceRequestAccepted => (
          icon: Icons.thumb_up_alt_outlined,
          tone: AppTone.info,
        ),
      NotificationTypes.serviceRequestRejected => (
          icon: Icons.block_outlined,
          tone: AppTone.error,
        ),
      NotificationTypes.serviceRequestInProgress => (
          icon: Icons.engineering_outlined,
          tone: AppTone.progress,
        ),
      NotificationTypes.serviceRequestCompleted => (
          icon: Icons.check_circle_outline,
          tone: AppTone.success,
        ),
      NotificationTypes.serviceRequestCancelled => (
          icon: Icons.cancel_outlined,
          tone: AppTone.neutral,
        ),
      _ => (icon: Icons.notifications_outlined, tone: AppTone.brand),
    };
  }
}
