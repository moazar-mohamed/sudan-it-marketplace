import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/error_messages.dart';
import '../../../core/localization/locale_controller.dart';
import '../../auth/domain/entities/user_role.dart';
import '../../chats/presentation/chat_providers.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../data/firestore_reports_repository.dart';
import '../domain/report.dart';
import '../domain/reports_repository.dart';

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  return FirestoreReportsRepository();
});

/// The signed-in person's own reports, newest first.
final myReportsProvider = StreamProvider<List<Report>>((ref) {
  final userId = ref.watch(currentUserIdProvider);
  if (userId == null || userId.isEmpty) return Stream.value(const []);
  return ref.watch(reportsRepositoryProvider).watchMyReports(userId);
});

final reportActionsProvider = Provider<ReportActions>((ref) {
  return ReportActions(ref);
});

/// Sends a report in the signed-in person's own name. Returns null on success,
/// otherwise a message for the person.
class ReportActions {
  ReportActions(this._ref);

  final Ref _ref;

  Future<String?> submit(ReportDraft draft) async {
    final l10n = _ref.read(appLocalizationsProvider);
    final userId = _ref.read(currentUserIdProvider);
    // Waits for the profile if it is still loading (it carries the role and name).
    final profile = await _ref.read(profileControllerProvider.future);
    if (userId == null || profile == null) return l10n.errorPermissionDenied;
    // Platform Admin has its own panel and the rules refuse its reports.
    if (profile.role == UserRole.platformAdmin) {
      return l10n.errorPermissionDenied;
    }
    try {
      await _ref.read(reportsRepositoryProvider).submit(
            reporterId: userId,
            reporterRole: profile.role.firestoreValue,
            reporterName: profile.fullName,
            reporterEmail: profile.email,
            draft: draft,
            companyId:
                profile.role == UserRole.customer ? null : profile.companyId,
          );
      return null;
    } on ReportLimitReached {
      return l10n.reportLimitReached;
    } catch (error) {
      return localizedErrorMessage(l10n, error);
    }
  }
}
