import 'package:flutter/material.dart';

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

  Color get color => switch (this) {
        ServiceRequestStatus.pending => Colors.amber.shade800,
        ServiceRequestStatus.accepted => AppColors.primary,
        ServiceRequestStatus.inProgress => Colors.deepOrange,
        ServiceRequestStatus.completed => AppColors.success,
        ServiceRequestStatus.rejected ||
        ServiceRequestStatus.cancelled =>
          AppColors.error,
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
