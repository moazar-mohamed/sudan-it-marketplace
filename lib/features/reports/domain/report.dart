/// Why a person is reporting. The value is what firestore.rules accepts and
/// what the Platform Admin panel shows.
enum ReportReason {
  orderProblem('order_problem'),
  payment('payment'),
  companyConduct('company_conduct'),
  productIssue('product_issue'),
  appProblem('app_problem'),
  other('other');

  const ReportReason(this.value);

  final String value;

  static ReportReason fromValue(String? value) {
    for (final reason in values) {
      if (reason.value == value) return reason;
    }
    return ReportReason.other;
  }
}

/// Where a report stands; only Platform Admin changes it.
enum ReportStatus {
  newReport('new'),
  inProgress('in_progress'),
  closed('closed');

  const ReportStatus(this.value);

  final String value;

  static ReportStatus fromValue(String? value) {
    for (final status in values) {
      if (status.value == value) return status;
    }
    return ReportStatus.newReport;
  }
}

/// What the person fills in on the report form.
class ReportDraft {
  const ReportDraft({
    required this.reason,
    required this.subject,
    required this.details,
    this.orderRef = '',
  });

  final ReportReason reason;
  final String subject;
  final String details;

  /// The order the report is about, as the person typed it (optional).
  final String orderRef;
}

/// One report as it is stored in `reports/{id}`.
class Report {
  const Report({
    required this.id,
    required this.reporterId,
    required this.reporterRole,
    required this.reporterName,
    required this.reporterEmail,
    required this.reason,
    required this.subject,
    required this.details,
    required this.status,
    required this.resolution,
    required this.createdAt,
    required this.updatedAt,
    this.companyId,
    this.orderRef = '',
  });

  final String id;
  final String reporterId;

  /// `customer`, `company_admin` or `technician`.
  final String reporterRole;
  final String reporterName;
  final String reporterEmail;
  final ReportReason reason;
  final String subject;
  final String details;
  final ReportStatus status;

  /// What Platform Admin wrote back; empty until they do.
  final String resolution;
  final DateTime createdAt;
  final DateTime updatedAt;

  /// Set when the sender is a company admin or technician.
  final String? companyId;
  final String orderRef;

  bool get hasReply => resolution.trim().isNotEmpty;
}

/// Longest texts the rules accept.
const int reportSubjectMax = 120;
const int reportDetailsMax = 2000;
const int reportOrderRefMax = 40;
