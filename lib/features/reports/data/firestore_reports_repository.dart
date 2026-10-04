import 'package:cloud_firestore/cloud_firestore.dart';

import '../domain/report.dart';
import '../domain/reports_repository.dart';

/// Reports in `reports/{id}`. The sender writes one and reads only their own
/// (firestore.rules); Platform Admin handles them from the web panel.
class FirestoreReportsRepository implements ReportsRepository {
  FirestoreReportsRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _reports =>
      _firestore.collection('reports');

  /// Sorted here (newest first) so no composite index is needed.
  @override
  Stream<List<Report>> watchMyReports(String reporterId) {
    return _reports.where('reporterId', isEqualTo: reporterId).snapshots().map(
      (snapshot) {
        return [
          for (final doc in snapshot.docs) reportFromMap(doc.id, doc.data()),
        ]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      },
    );
  }

  @override
  Future<void> submit({
    required String reporterId,
    required String reporterRole,
    required String reporterName,
    required String reporterEmail,
    required ReportDraft draft,
    String? companyId,
  }) async {
    final ref = _reports.doc();
    final orderRef = draft.orderRef.trim();

    // The person's quota keeps the times of their last five reports in five
    // slots, written in turn; the next one is free only when it is empty or at
    // least 24 hours old. The same step is written with the report, and the
    // rules check it, so the limit cannot be skipped.
    final quotaRef = _firestore.collection('report_quota').doc(reporterId);
    final quota = await quotaRef.get();
    final stored = quota.data();
    final current = (stored?['next'] as num?)?.toInt() ?? 0;
    final stamp = stored?['t$current'];
    final step = planReportQuota(
      next: current,
      oldest: stamp is Timestamp ? stamp.toDate() : null,
      now: DateTime.now(),
    );

    final batch = _firestore.batch();
    batch.set(ref, {
      'id': ref.id,
      'reporterId': reporterId,
      'reporterRole': reporterRole,
      'reporterName': reporterName,
      'reporterEmail': reporterEmail,
      if (companyId != null && companyId.isNotEmpty) 'companyId': companyId,
      'reason': draft.reason.value,
      'subject': draft.subject.trim(),
      'details': draft.details.trim(),
      if (orderRef.isNotEmpty) 'orderRef': orderRef,
      'status': ReportStatus.newReport.value,
      'resolution': '',
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    if (quota.exists) {
      batch.update(quotaRef, {
        step.slot: FieldValue.serverTimestamp(),
        'next': step.next,
        'lastReportId': ref.id,
      });
    } else {
      batch.set(quotaRef, {
        't0': FieldValue.serverTimestamp(),
        'next': 1,
        'lastReportId': ref.id,
      });
    }
    await batch.commit();
  }
}

/// A stored report; a field written by a newer app is read as its default.
Report reportFromMap(String id, Map<String, dynamic> data) {
  DateTime time(Object? value) => switch (value) {
        Timestamp() => value.toDate(),
        DateTime() => value,
        _ => DateTime.fromMillisecondsSinceEpoch(0),
      };
  return Report(
    id: id,
    reporterId: data['reporterId'] as String? ?? '',
    reporterRole: data['reporterRole'] as String? ?? '',
    reporterName: data['reporterName'] as String? ?? '',
    reporterEmail: data['reporterEmail'] as String? ?? '',
    reason: ReportReason.fromValue(data['reason'] as String?),
    subject: data['subject'] as String? ?? '',
    details: data['details'] as String? ?? '',
    status: ReportStatus.fromValue(data['status'] as String?),
    resolution: data['resolution'] as String? ?? '',
    createdAt: time(data['createdAt']),
    updatedAt: time(data['updatedAt']),
    companyId: data['companyId'] as String?,
    orderRef: data['orderRef'] as String? ?? '',
  );
}
