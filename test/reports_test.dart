import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/reports/data/firestore_reports_repository.dart';
import 'package:sudan_it_marketplace/features/reports/domain/report.dart';
import 'package:sudan_it_marketplace/features/reports/domain/reports_repository.dart';
import 'package:sudan_it_marketplace/features/reports/presentation/my_reports_screen.dart';
import 'package:sudan_it_marketplace/features/reports/presentation/report_form_screen.dart';
import 'package:sudan_it_marketplace/features/reports/presentation/reports_providers.dart';
import 'package:sudan_it_marketplace/features/settings/presentation/settings_screen.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

import 'helpers/field_finders.dart';

class _Submitted {
  _Submitted({
    required this.reporterId,
    required this.reporterRole,
    required this.reporterName,
    required this.reporterEmail,
    required this.draft,
    required this.companyId,
  });

  final String reporterId;
  final String reporterRole;
  final String reporterName;
  final String reporterEmail;
  final ReportDraft draft;
  final String? companyId;
}

class _FakeRepository implements ReportsRepository {
  _FakeRepository({this.fail = false, this.limit = false});

  final bool fail;

  /// Five reports were already sent in the last 24 hours.
  final bool limit;
  final sent = <_Submitted>[];
  final controller = StreamController<List<Report>>.broadcast();

  @override
  Stream<List<Report>> watchMyReports(String reporterId) => controller.stream;

  @override
  Future<void> submit({
    required String reporterId,
    required String reporterRole,
    required String reporterName,
    required String reporterEmail,
    required ReportDraft draft,
    String? companyId,
  }) async {
    if (limit) throw const ReportLimitReached();
    if (fail) throw FirebaseException(plugin: 'cloud_firestore', code: 'permission-denied');
    sent.add(
      _Submitted(
        reporterId: reporterId,
        reporterRole: reporterRole,
        reporterName: reporterName,
        reporterEmail: reporterEmail,
        draft: draft,
        companyId: companyId,
      ),
    );
  }
}

class _FakeProfile extends ProfileController {
  _FakeProfile(this._profile);

  final UserProfile _profile;

  @override
  Future<UserProfile?> build() async => _profile;
}

UserProfile _person(UserRole role, {String? companyId}) => UserProfile(
      id: 'u1',
      fullName: 'Sara Ali',
      email: 'sara@example.test',
      role: role,
      createdAt: DateTime(2026),
      isActive: true,
      companyId: companyId,
    );

Widget _app(
  Widget home,
  _FakeRepository repository, {
  UserProfile? profile,
  String language = 'en',
}) =>
    ProviderScope(
      overrides: [
        reportsRepositoryProvider.overrideWithValue(repository),
        currentUserIdProvider.overrideWithValue('u1'),
        profileControllerProvider.overrideWith(
          () => _FakeProfile(profile ?? _person(UserRole.customer)),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        locale: Locale(language),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

Report _report({
  ReportStatus status = ReportStatus.newReport,
  String resolution = '',
  String subject = 'My order never arrived',
}) =>
    Report(
      id: 'r1',
      reporterId: 'u1',
      reporterRole: 'customer',
      reporterName: 'Sara Ali',
      reporterEmail: 'sara@example.test',
      reason: ReportReason.orderProblem,
      subject: subject,
      details: 'Ordered last week.',
      status: status,
      resolution: resolution,
      createdAt: DateTime(2026, 10, 2),
      updatedAt: DateTime(2026, 10, 2),
    );

Future<void> _fill(WidgetTester tester, {String subject = 'No delivery', String details = 'Nothing came.'}) async {
  await tester.enterText(fieldWithLabel('Subject'), subject);
  await tester.enterText(fieldWithLabel('What happened?'), details);
}

Future<void> _send(WidgetTester tester) async {
  await tester.drag(find.byType(ListView).first, const Offset(0, -700));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('report-submit')));
  await tester.pumpAndSettle();
}

void main() {
  group('the stored report', () {
    test('an unknown reason or status from a newer app falls back safely', () {
      expect(ReportReason.fromValue('brand_new'), ReportReason.other);
      expect(ReportStatus.fromValue('weird'), ReportStatus.newReport);
      expect(ReportStatus.fromValue('in_progress'), ReportStatus.inProgress);
      expect(ReportReason.fromValue('company_conduct'), ReportReason.companyConduct);
    });

    test('is read from its map, with dates, the company and the reply', () {
      final report = reportFromMap('r9', {
        'reporterId': 'u1',
        'reporterRole': 'company_admin',
        'reporterName': 'Nile Co',
        'reporterEmail': 'nile@example.test',
        'companyId': 'c1',
        'reason': 'payment',
        'subject': 'Unpaid order',
        'details': 'Please check.',
        'orderRef': 'AB12',
        'status': 'closed',
        'resolution': 'Paid.',
        'createdAt': Timestamp.fromDate(DateTime(2026, 10, 1)),
        'updatedAt': Timestamp.fromDate(DateTime(2026, 10, 2)),
      });
      expect(report.reason, ReportReason.payment);
      expect(report.status, ReportStatus.closed);
      expect(report.companyId, 'c1');
      expect(report.orderRef, 'AB12');
      expect(report.hasReply, isTrue);
      expect(report.createdAt, DateTime(2026, 10, 1));
    });

    test('a report with nothing written back has no reply', () {
      expect(_report().hasReply, isFalse);
      expect(_report(resolution: '   ').hasReply, isFalse);
    });
  });

  group('the report form', () {
    testWidgets('needs a subject and what happened before anything is sent', (tester) async {
      final repository = _FakeRepository();
      await tester.pumpWidget(_app(const ReportFormScreen(), repository));
      await tester.pumpAndSettle();
      await _send(tester);
      expect(find.text('Enter a subject.'), findsOneWidget);
      expect(find.text('Describe the problem.'), findsOneWidget);
      expect(repository.sent, isEmpty);
    });

    testWidgets('sends the report in the person\'s own name, as a customer', (tester) async {
      final repository = _FakeRepository();
      await tester.pumpWidget(_app(const ReportFormScreen(), repository));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('report-reason-payment')));
      await tester.pump();
      await _fill(tester, subject: '  Charged twice ', details: 'Two payments.');
      await tester.enterText(fieldWithLabel('Order number'), 'AB12CD');
      await _send(tester);

      expect(repository.sent, hasLength(1));
      final sent = repository.sent.single;
      expect(sent.reporterId, 'u1');
      expect(sent.reporterRole, 'customer');
      expect(sent.reporterName, 'Sara Ali');
      expect(sent.reporterEmail, 'sara@example.test');
      expect(sent.companyId, isNull);
      expect(sent.draft.reason, ReportReason.payment);
      expect(sent.draft.orderRef, 'AB12CD');
    });

    testWidgets('a company admin\'s report carries the company', (tester) async {
      final repository = _FakeRepository();
      await tester.pumpWidget(
        _app(
          const ReportFormScreen(),
          repository,
          profile: _person(UserRole.companyAdmin, companyId: 'c1'),
        ),
      );
      await tester.pumpAndSettle();
      await _fill(tester);
      await _send(tester);
      expect(repository.sent.single.reporterRole, 'company_admin');
      expect(repository.sent.single.companyId, 'c1');
    });

    testWidgets('a Platform Admin cannot send one from the app', (tester) async {
      final repository = _FakeRepository();
      await tester.pumpWidget(
        _app(const ReportFormScreen(), repository, profile: _person(UserRole.platformAdmin)),
      );
      await tester.pumpAndSettle();
      await _fill(tester);
      await _send(tester);
      expect(repository.sent, isEmpty);
    });

    testWidgets('says so and keeps what was typed when the rules refuse', (tester) async {
      final repository = _FakeRepository(fail: true);
      await tester.pumpWidget(_app(const ReportFormScreen(), repository));
      await tester.pumpAndSettle();
      await _fill(tester, subject: 'Keep me');
      await _send(tester);
      expect(find.byType(ReportFormScreen), findsOneWidget);
      expect(find.text('Keep me'), findsOneWidget);
    });

    testWidgets('says when five were already sent today, and keeps what was typed', (tester) async {
      await tester.pumpWidget(_app(const ReportFormScreen(), _FakeRepository(limit: true)));
      await tester.pumpAndSettle();
      await _fill(tester, subject: 'Sixth one');
      await _send(tester);
      expect(find.text('You can send 5 reports in 24 hours. Please try again later.'), findsOneWidget);
      expect(find.text('Sixth one'), findsOneWidget);
    });

    testWidgets('is in Arabic too', (tester) async {
      await tester.pumpWidget(_app(const ReportFormScreen(), _FakeRepository(), language: 'ar'));
      await tester.pumpAndSettle();
      expect(find.text('الإبلاغ عن مشكلة'), findsOneWidget);
      expect(find.text('مشكلة في طلب'), findsOneWidget);
    });
  });

  group('my reports', () {
    testWidgets('invites a first report when there are none', (tester) async {
      final repository = _FakeRepository();
      await tester.pumpWidget(_app(const MyReportsScreen(), repository));
      await tester.pump();
      repository.controller.add(const []);
      await tester.pumpAndSettle();
      expect(find.text('You have not sent any report.'), findsOneWidget);
      await tester.tap(find.text('Report a problem'));
      await tester.pumpAndSettle();
      expect(find.byType(ReportFormScreen), findsOneWidget);
    });

    testWidgets('shows where each report stands and what the team answered', (tester) async {
      final repository = _FakeRepository();
      await tester.pumpWidget(_app(const MyReportsScreen(), repository));
      await tester.pump();
      repository.controller.add([
        _report(subject: 'Waiting one'),
        _report(subject: 'Done one', status: ReportStatus.closed, resolution: 'Refunded in full.'),
      ]);
      await tester.pumpAndSettle();
      expect(find.text('Waiting one'), findsOneWidget);
      expect(find.text('Received'), findsOneWidget);
      expect(find.text('No reply yet.'), findsOneWidget);
      expect(find.text('Closed'), findsOneWidget);
      expect(find.text('Refunded in full.'), findsOneWidget);
    });
  });

  group('Settings', () {
    testWidgets('has a Help group with both entries', (tester) async {
      await tester.pumpWidget(_app(const SettingsScreen(), _FakeRepository()));
      await tester.pumpAndSettle();
      await tester.dragUntilVisible(
        find.byKey(const ValueKey('settings-report')),
        find.byType(ListView).first,
        const Offset(0, -100),
      );
      expect(find.text('HELP'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('settings-report')));
      await tester.pumpAndSettle();
      expect(find.byType(ReportFormScreen), findsOneWidget);
    });

    testWidgets('opens My reports', (tester) async {
      await tester.pumpWidget(_app(const SettingsScreen(), _FakeRepository()));
      await tester.pumpAndSettle();
      await tester.dragUntilVisible(
        find.byKey(const ValueKey('settings-my-reports')),
        find.byType(ListView).first,
        const Offset(0, -100),
      );
      // The row can still be half under the screen edge: bring it fully in.
      await tester.drag(find.byType(ListView).first, const Offset(0, -150));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('settings-my-reports')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(MyReportsScreen), findsOneWidget);
      expect(find.text('My reports'), findsWidgets);
    });
  });
}
