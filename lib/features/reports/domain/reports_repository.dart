import 'report.dart';

/// The send limit: five reports in any 24 hours, per person. Keep it in step
/// with `reportCountsAgainstQuota` in firestore.rules.
abstract final class ReportQuota {
  static const int reportsPerDay = 5;
  static const Duration window = Duration(hours: 24);
}

/// Which slot of the person's quota the next report writes, and the `next`
/// that follows it.
class ReportQuotaStep {
  const ReportQuotaStep({required this.slot, required this.next});

  /// The field to write: `t0`..`t4`.
  final String slot;
  final int next;
}

/// The step the next report takes: [next] is the slot written next and
/// [oldest] the time stored in it (null while it is still empty). Throws
/// [ReportLimitReached] when that slot is less than 24 hours old, since it
/// always holds the oldest of the last five.
ReportQuotaStep planReportQuota({
  required int next,
  required DateTime? oldest,
  required DateTime now,
}) {
  if (oldest != null && now.difference(oldest) < ReportQuota.window) {
    throw const ReportLimitReached();
  }
  return ReportQuotaStep(
    slot: 't$next',
    next: (next + 1) % ReportQuota.reportsPerDay,
  );
}

/// The person has already sent as many reports as the limit allows.
class ReportLimitReached implements Exception {
  const ReportLimitReached();
}

abstract class ReportsRepository {
  /// The signed-in person's own reports, newest first.
  Stream<List<Report>> watchMyReports(String reporterId);

  /// Sends a report in the person's own name; it starts as new, with no reply.
  /// Throws [ReportLimitReached] when five were sent in the last 24 hours.
  Future<void> submit({
    required String reporterId,
    required String reporterRole,
    required String reporterName,
    required String reporterEmail,
    required ReportDraft draft,
    String? companyId,
  });
}
