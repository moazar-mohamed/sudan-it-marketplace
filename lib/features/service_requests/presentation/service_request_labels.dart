import '../../../core/theme/app_colors.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/entities/service_request.dart';

extension ServiceRequestStatusLabels on ServiceRequestStatus {
  String label(AppLocalizations l10n) => switch (this) {
        ServiceRequestStatus.pending => l10n.serviceRequestStatusPending,
        ServiceRequestStatus.accepted => l10n.serviceRequestStatusAccepted,
        ServiceRequestStatus.rejected => l10n.serviceRequestStatusRejected,
        ServiceRequestStatus.inProgress =>
          l10n.serviceRequestStatusInProgress,
        ServiceRequestStatus.completed => l10n.serviceRequestStatusCompleted,
        ServiceRequestStatus.cancelled => l10n.serviceRequestStatusCancelled,
      };

  /// Colour family of the status chip. A cancelled request is neutral: it
  /// was withdrawn, not refused.
  AppTone get tone => switch (this) {
        ServiceRequestStatus.pending => AppTone.warning,
        ServiceRequestStatus.accepted => AppTone.info,
        ServiceRequestStatus.inProgress => AppTone.progress,
        ServiceRequestStatus.completed => AppTone.success,
        ServiceRequestStatus.rejected => AppTone.error,
        ServiceRequestStatus.cancelled => AppTone.neutral,
      };
}

/// Grouped digits and the currency, e.g. "15,000 SDG".
String formatServicePrice(double value, [String currency = 'SDG']) {
  final whole = value.toStringAsFixed(0);
  final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
  return '${whole.replaceAllMapped(regExp, (m) => '${m[1]},')} $currency';
}

/// "2026-09-23 14:05" in local time.
String formatServiceDate(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)} '
      '${two(local.hour)}:${two(local.minute)}';
}
