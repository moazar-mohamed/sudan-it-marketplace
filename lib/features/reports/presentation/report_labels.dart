import 'package:flutter/widgets.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/report.dart';

String reportReasonLabel(BuildContext context, ReportReason reason) {
  final l10n = context.l10n;
  return switch (reason) {
    ReportReason.orderProblem => l10n.reportReasonOrderProblem,
    ReportReason.payment => l10n.reportReasonPayment,
    ReportReason.companyConduct => l10n.reportReasonCompanyConduct,
    ReportReason.productIssue => l10n.reportReasonProductIssue,
    ReportReason.appProblem => l10n.reportReasonAppProblem,
    ReportReason.other => l10n.reportReasonOther,
  };
}

/// What the person sees: a new report reads "Received", since it is theirs.
String reportStatusLabel(BuildContext context, ReportStatus status) {
  final l10n = context.l10n;
  return switch (status) {
    ReportStatus.newReport => l10n.reportStatusNew,
    ReportStatus.inProgress => l10n.reportStatusInProgress,
    ReportStatus.closed => l10n.reportStatusClosed,
  };
}

AppTone reportStatusTone(ReportStatus status) => switch (status) {
      ReportStatus.newReport => AppTone.warning,
      ReportStatus.inProgress => AppTone.progress,
      ReportStatus.closed => AppTone.success,
    };
