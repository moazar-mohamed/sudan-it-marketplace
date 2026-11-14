import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/notifications/data/models/app_notification_model.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/entities/app_notification.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notification_events.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notification_format.dart';
import 'package:sudan_it_marketplace/features/push/presentation/push_destination.dart';
import 'package:sudan_it_marketplace/features/reports/domain/reports_repository.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

AppNotification _note(String type) => AppNotification(
      id: 'r1_$type',
      recipientType: NotificationRecipientType.customer,
      recipientId: 'u1',
      reportId: 'r1',
      type: type,
      productName: 'My order never arrived',
      createdAt: DateTime(2026, 10, 4),
    );

UserProfile _profile(UserRole role) => UserProfile(
      id: 'u1',
      fullName: 'Sara',
      email: 's@example.test',
      role: role,
      createdAt: DateTime(2026),
      isActive: true,
      companyId: role == UserRole.companyAdmin ? 'c1' : null,
    );

void main() {
  group('the five-reports-a-day limit', () {
    final now = DateTime(2026, 10, 4, 12);

    test('a slot that is empty, or at least 24 hours old, is free', () {
      final fresh = planReportQuota(next: 0, oldest: null, now: now);
      expect((fresh.slot, fresh.next), ('t0', 1));
      final old = planReportQuota(
        next: 2,
        oldest: now.subtract(const Duration(hours: 24)),
        now: now,
      );
      expect((old.slot, old.next), ('t2', 3));
    });

    test('the last slot hands over to the first', () {
      final step = planReportQuota(next: 4, oldest: null, now: now);
      expect((step.slot, step.next), ('t4', 0));
    });

    test('a slot younger than 24 hours means five were sent in the last day', () {
      expect(
        () => planReportQuota(
          next: 1,
          oldest: now.subtract(const Duration(hours: 23, minutes: 59)),
          now: now,
        ),
        throwsA(isA<ReportLimitReached>()),
      );
    });

    test('the limit is the one in the rules', () {
      expect(ReportQuota.reportsPerDay, 5);
      expect(ReportQuota.window, const Duration(hours: 24));
    });
  });

  group('a notification about a report', () {
    test('is read with its report id, and carries no text of its own', () {
      final note = AppNotificationModel.fromMap('r1_report_closed', {
        'recipientType': 'customer',
        'recipientId': 'u1',
        'reportId': 'r1',
        'type': 'report_closed',
        'productName': 'My order never arrived',
        'title': 'ignored',
        'body': 'ignored',
      });
      expect(note.reportId, 'r1');
      expect(note.orderId, isEmpty);
      expect(note.serviceRequestId, isEmpty);
    });

    test('is worded from its type and the report subject, in both languages', () {
      final en = AppLocalizationsEn();
      final ar = AppLocalizationsAr();
      final closed = _note(NotificationTypes.reportClosed);
      final started = _note(NotificationTypes.reportInProgress);
      expect(NotificationFormat.title(en, closed), 'Your report was closed');
      expect(NotificationFormat.body(en, closed), contains('"My order never arrived"'));
      expect(NotificationFormat.title(en, started), 'Your report is being handled');
      expect(NotificationFormat.title(ar, closed), 'تم إغلاق بلاغك');
      expect(NotificationFormat.body(ar, started), contains('My order never arrived'));
    });

    test('is not one of the types the app itself sends', () {
      expect(NotificationTypes.all, isNot(contains(NotificationTypes.reportClosed)));
      expect(NotificationTypes.all, isNot(contains(NotificationTypes.reportInProgress)));
    });

    test('a push about it opens My reports, for a customer and a company admin only', () {
      final data = {'type': 'report_closed', 'reportId': 'r1', 'recipientType': 'customer'};
      expect(pushDestination(data, _profile(UserRole.customer)), isA<ReportDestination>());
      expect(
        pushDestination({...data, 'recipientType': 'company_admin'}, _profile(UserRole.companyAdmin)),
        isA<ReportDestination>(),
      );
      expect(pushDestination(data, _profile(UserRole.companyAdmin)), isNull);
      expect(pushDestination(data, _profile(UserRole.technician)), isNull);
    });
  });
}
