import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sudan_it_marketplace/core/localization/locale_controller.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/platform_notices/domain/platform_notices.dart';
import 'package:sudan_it_marketplace/features/platform_notices/presentation/platform_notice_gate.dart';
import 'package:sudan_it_marketplace/features/platform_notices/presentation/platform_notices_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

Map<String, dynamic> _data({
  bool maintenance = false,
  String maintenanceAr = '',
  String maintenanceEn = '',
  DateTime? maintenanceStarts,
  DateTime? maintenanceEnds,
  String maintenanceLink = '',
  String maintenanceLabelEn = '',
  bool announcement = false,
  String announcementAr = '',
  String announcementEn = '',
  String audience = 'all',
  String kind = 'info',
  DateTime? announcementStarts,
  DateTime? announcementEnds,
  String announcementLink = '',
  String announcementLabelAr = '',
  String announcementLabelEn = '',
  int minBuild = 0,
  String updateUrl = '',
  String updateAr = '',
  String updateEn = '',
}) =>
    {
      'maintenance': {
        'enabled': maintenance,
        'messageAr': maintenanceAr,
        'messageEn': maintenanceEn,
        'startsAt': maintenanceStarts == null ? null : Timestamp.fromDate(maintenanceStarts),
        'endsAt': maintenanceEnds == null ? null : Timestamp.fromDate(maintenanceEnds),
        'linkUrl': maintenanceLink,
        'linkLabelAr': '',
        'linkLabelEn': maintenanceLabelEn,
      },
      'announcement': {
        'enabled': announcement,
        'messageAr': announcementAr,
        'messageEn': announcementEn,
        'audience': audience,
        'kind': kind,
        'startsAt': announcementStarts == null ? null : Timestamp.fromDate(announcementStarts),
        'endsAt': announcementEnds == null ? null : Timestamp.fromDate(announcementEnds),
        'linkUrl': announcementLink,
        'linkLabelAr': announcementLabelAr,
        'linkLabelEn': announcementLabelEn,
      },
      'update': {
        'minBuild': minBuild,
        'url': updateUrl,
        'messageAr': updateAr,
        'messageEn': updateEn,
      },
    };

void main() {
  group('PlatformNotices', () {
    test('is all off when the document is missing', () {
      final notices = PlatformNotices.fromData(null);
      expect(notices.maintenance.textFor('en'), isNull);
      expect(notices.announcement.textFor('ar'), isNull);
      expect(notices.audience, NoticeAudience.all);
    });

    test('shows the text in the reader\'s language and falls back to the other', () {
      const both = PlatformNotice(enabled: true, messageAr: 'عربي', messageEn: 'English');
      expect(both.textFor('ar'), 'عربي');
      expect(both.textFor('en'), 'English');
      const onlyEnglish = PlatformNotice(enabled: true, messageEn: 'English');
      expect(onlyEnglish.textFor('ar'), 'English');
      const onlyArabic = PlatformNotice(enabled: true, messageAr: 'عربي');
      expect(onlyArabic.textFor('en'), 'عربي');
    });

    test('a notice that is off, or has no text, shows nothing', () {
      expect(const PlatformNotice(messageEn: 'x').textFor('en'), isNull);
      expect(const PlatformNotice(enabled: true).textFor('en'), isNull);
    });

    test('tolerates mistyped values', () {
      final notices = PlatformNotices.fromData({
        'maintenance': {'enabled': 'yes', 'messageAr': 5},
        'announcement': {'enabled': true, 'messageEn': ' hi ', 'audience': 'technicians'},
      });
      expect(notices.maintenance.enabled, isFalse);
      expect(notices.announcement.textFor('en'), 'hi');
      expect(notices.audience, NoticeAudience.all);
    });

    test('an announcement is for the audience it names', () {
      PlatformNotices with_(String audience) => PlatformNotices.fromData(
            _data(announcement: true, announcementEn: 'x', audience: audience),
          );
      final everyone = with_('all');
      expect(everyone.announcementIsFor(null), isTrue);
      expect(everyone.announcementIsFor(UserRole.customer), isTrue);

      final customers = with_('customers');
      expect(customers.announcementIsFor(UserRole.customer), isTrue);
      expect(customers.announcementIsFor(UserRole.companyAdmin), isFalse);
      expect(customers.announcementIsFor(null), isFalse);

      final companies = with_('companies');
      expect(companies.announcementIsFor(UserRole.companyAdmin), isTrue);
      expect(companies.announcementIsFor(UserRole.technician), isTrue);
      expect(companies.announcementIsFor(UserRole.customer), isFalse);
      expect(companies.announcementIsFor(null), isFalse);
    });

    test('the key changes with the text or the audience', () {
      PlatformNotices with_(String text, String audience) => PlatformNotices.fromData(
            _data(announcement: true, announcementEn: text, audience: audience),
          );
      expect(with_('a', 'all').announcementKey, with_('a', 'all').announcementKey);
      expect(with_('a', 'all').announcementKey, isNot(with_('b', 'all').announcementKey));
      expect(with_('a', 'all').announcementKey, isNot(with_('a', 'customers').announcementKey));
    });
  });

  group('the schedule', () {
    final start = DateTime(2026, 10, 5, 10);
    final end = DateTime(2026, 10, 5, 12);

    test('a notice with no schedule is on whenever it is switched on', () {
      const notice = PlatformNotice(enabled: true, messageEn: 'x');
      expect(notice.hasSchedule, isFalse);
      expect(notice.isActiveAt(DateTime(2000)), isTrue);
      expect(notice.isActiveAt(DateTime(2100)), isTrue);
      expect(const PlatformNotice(messageEn: 'x').isActiveAt(DateTime(2026)), isFalse);
    });

    test('starts at its start time and is over at its end time', () {
      final notice = PlatformNotice(enabled: true, messageEn: 'x', startsAt: start, endsAt: end);
      expect(notice.hasSchedule, isTrue);
      expect(notice.isActiveAt(start.subtract(const Duration(seconds: 1))), isFalse);
      expect(notice.isActiveAt(start), isTrue);
      expect(notice.isActiveAt(end.subtract(const Duration(seconds: 1))), isTrue);
      expect(notice.isActiveAt(end), isFalse);
    });

    test('a start alone runs until switched off, an end alone starts at once', () {
      expect(PlatformNotice(enabled: true, messageEn: 'x', startsAt: start).isActiveAt(DateTime(2030)), isTrue);
      expect(PlatformNotice(enabled: true, messageEn: 'x', endsAt: end).isActiveAt(DateTime(2020)), isTrue);
      expect(PlatformNotice(enabled: true, messageEn: 'x', endsAt: end).isActiveAt(DateTime(2030)), isFalse);
    });

    test('its text is hidden outside the schedule, but still read when no time is given', () {
      final notice = PlatformNotice(enabled: true, messageEn: 'x', startsAt: start, endsAt: end);
      expect(notice.textFor('en', now: DateTime(2026, 10, 5, 9)), isNull);
      expect(notice.textFor('en', now: DateTime(2026, 10, 5, 11)), 'x');
      expect(notice.textFor('en', now: DateTime(2026, 10, 5, 13)), isNull);
      expect(notice.textFor('en'), 'x');
    });

    test('reads the times from Firestore timestamps and ignores anything else', () {
      final notices = PlatformNotices.fromData(_data(maintenance: true, maintenanceEn: 'x', maintenanceStarts: start, maintenanceEnds: end));
      expect(notices.maintenance.startsAt, start);
      expect(notices.maintenance.endsAt, end);
      expect(notices.hasSchedule, isTrue);
      final odd = PlatformNotices.fromData({
        'maintenance': {'enabled': true, 'messageEn': 'x', 'startsAt': 'soon', 'endsAt': 5},
      });
      expect(odd.maintenance.startsAt, isNull);
      expect(odd.maintenance.endsAt, isNull);
      expect(odd.hasSchedule, isFalse);
    });
  });

  group('the button and the kind', () {
    test('only an https link counts', () {
      expect(const NoticeLink(url: 'https://example.com/a', labelEn: 'Go').uri, Uri.parse('https://example.com/a'));
      for (final bad in ['http://example.com', 'javascript:alert(1)', 'ftp://example.com', 'example.com', 'https://', '']) {
        expect(NoticeLink(url: bad, labelEn: 'Go').uri, isNull, reason: bad);
        expect(NoticeLink(url: bad, labelEn: 'Go').labelFor('en'), isNull, reason: bad);
      }
    });

    test('its label is in the reader\'s language, else the other, else none', () {
      const link = NoticeLink(url: 'https://example.com', labelAr: 'افتح', labelEn: 'Open');
      expect(link.labelFor('ar'), 'افتح');
      expect(link.labelFor('en'), 'Open');
      expect(const NoticeLink(url: 'https://example.com', labelEn: 'Open').labelFor('ar'), 'Open');
      expect(const NoticeLink(url: 'https://example.com').labelFor('en'), isNull);
    });

    test('the kind is information unless the document names another', () {
      expect(AnnouncementKind.parse('warning'), AnnouncementKind.warning);
      expect(AnnouncementKind.parse('success'), AnnouncementKind.success);
      expect(AnnouncementKind.parse('danger'), AnnouncementKind.info);
      expect(AnnouncementKind.parse(null), AnnouncementKind.info);
      expect(PlatformNotices.fromData(_data(kind: 'success')).announcementKind, AnnouncementKind.success);
    });

    test('a closed announcement returns when its kind or its link changes', () {
      PlatformNotices with_({String kind = 'info', String link = ''}) => PlatformNotices.fromData(
            _data(announcement: true, announcementEn: 'x', kind: kind, announcementLink: link, announcementLabelEn: 'Go'),
          );
      expect(with_().announcementKey, isNot(with_(kind: 'warning').announcementKey));
      expect(with_().announcementKey, isNot(with_(link: 'https://example.com').announcementKey));
    });

    test('an older document, without the new fields, still reads', () {
      final notices = PlatformNotices.fromData({
        'maintenance': {'enabled': true, 'messageEn': 'Back soon'},
        'announcement': {'enabled': true, 'messageEn': 'Hi', 'audience': 'customers'},
      });
      expect(notices.maintenance.textFor('en'), 'Back soon');
      expect(notices.announcementKind, AnnouncementKind.info);
      expect(notices.announcement.link.uri, isNull);
      expect(notices.update.minBuild, 0);
    });
  });

  group('the required update', () {
    test('stops an app below the lowest build and no other', () {
      const update = RequiredUpdate(minBuild: 6, url: 'https://example.com/app.apk');
      expect(update.isRequiredFor(5), isTrue);
      expect(update.isRequiredFor(1), isTrue);
      expect(update.isRequiredFor(6), isFalse);
      expect(update.isRequiredFor(7), isFalse);
    });

    test('never stops an app whose build is unknown, or when nothing is required', () {
      expect(const RequiredUpdate(minBuild: 6).isRequiredFor(null), isFalse);
      expect(const RequiredUpdate().isRequiredFor(1), isFalse);
    });

    test('reads the build as a whole number, else no requirement', () {
      expect(RequiredUpdate.fromData({'minBuild': 6}).minBuild, 6);
      expect(RequiredUpdate.fromData({'minBuild': '6'}).minBuild, 0);
      expect(RequiredUpdate.fromData({'minBuild': -2}).minBuild, 0);
      expect(RequiredUpdate.fromData(null).minBuild, 0);
    });

    test('the download page must be https', () {
      expect(const RequiredUpdate(url: 'https://example.com').uri, isNotNull);
      expect(const RequiredUpdate(url: 'http://example.com').uri, isNull);
    });
  });


  group('the notice gate', () {
    late StreamController<PlatformNotices> notices;
    late StreamController<DateTime> clock;
    late List<Uri> opened;

    setUp(() {
      notices = StreamController<PlatformNotices>.broadcast();
      clock = StreamController<DateTime>.broadcast();
      opened = [];
    });
    tearDown(() {
      notices.close();
      clock.close();
    });

    Future<void> open(
      WidgetTester tester, {
      UserRole? role,
      Locale locale = const Locale('en'),
      Map<String, Object> prefs = const {},
      int? build,
    }) async {
      SharedPreferences.setMockInitialValues(prefs);
      final preferences = await SharedPreferences.getInstance();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(preferences),
            platformNoticesProvider.overrideWith((ref) => notices.stream),
            noticeClockProvider.overrideWith((ref) => clock.stream),
            appBuildNumberProvider.overrideWith((ref) async => build),
            noticeLinkOpenerProvider.overrideWithValue((uri) async {
              opened.add(uri);
              return true;
            }),
            profileControllerProvider.overrideWith(() => _Profile(role)),
          ],
          child: MaterialApp(
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            builder: (context, child) => PlatformNoticeGate(child: child!),
            home: const _Counter(),
          ),
        ),
      );
      await tester.pump();
    }

    Future<void> send(WidgetTester tester, Map<String, dynamic> data) async {
      notices.add(PlatformNotices.fromData(data));
      await tester.pump();
      await tester.pump();
    }

    testWidgets('shows only the app while nothing is switched on', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(tester, _data());
      expect(find.byKey(const Key('maintenance-screen')), findsNothing);
      expect(find.byKey(const Key('announcement-banner')), findsNothing);
      expect(find.text('app'), findsOneWidget);
    });

    testWidgets('and while the notices are still loading or cannot be read', (tester) async {
      await open(tester, role: UserRole.customer);
      expect(find.byKey(const Key('maintenance-screen')), findsNothing);
      notices.addError(Exception('offline'));
      await tester.pump();
      expect(find.byKey(const Key('maintenance-screen')), findsNothing);
      expect(find.text('app'), findsOneWidget);
    });

    testWidgets('maintenance covers the app with the message in the reader\'s language', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(tester, _data(maintenance: true, maintenanceAr: 'نعود قريباً', maintenanceEn: 'Back soon'));
      expect(find.byKey(const Key('maintenance-screen')), findsOneWidget);
      expect(find.text('Under maintenance'), findsOneWidget);
      expect(find.text('Back soon'), findsOneWidget);
      expect(find.text('نعود قريباً'), findsNothing);
    });

    testWidgets('in Arabic', (tester) async {
      await open(tester, role: UserRole.customer, locale: const Locale('ar'));
      await send(tester, _data(maintenance: true, maintenanceAr: 'نعود قريباً', maintenanceEn: 'Back soon'));
      expect(find.text('نعود قريباً'), findsOneWidget);
      expect(find.text('المنصة تحت الصيانة'), findsOneWidget);
    });

    testWidgets('reaches people who are signed out too', (tester) async {
      await open(tester, role: null);
      await send(tester, _data(maintenance: true, maintenanceEn: 'Back soon'));
      expect(find.byKey(const Key('maintenance-screen')), findsOneWidget);
    });

    testWidgets('never locks a Platform Admin out', (tester) async {
      await open(tester, role: UserRole.platformAdmin);
      await send(tester, _data(maintenance: true, maintenanceEn: 'Back soon'));
      expect(find.byKey(const Key('maintenance-screen')), findsNothing);
    });

    testWidgets('keeps the app underneath running, so ending maintenance restarts nothing', (tester) async {
      await open(tester, role: UserRole.customer);
      await tester.tap(find.byKey(const Key('counter')));
      await tester.pump();
      expect(find.text('taps: 1'), findsOneWidget);

      await send(tester, _data(maintenance: true, maintenanceEn: 'Back soon'));
      await send(tester, _data());
      expect(find.byKey(const Key('maintenance-screen')), findsNothing);
      expect(find.text('taps: 1'), findsOneWidget);
    });

    testWidgets('an announcement shows above the app for its audience and can be dismissed for good', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(tester, _data(announcement: true, announcementEn: 'Eid hours', audience: 'customers'));
      expect(find.byKey(const Key('announcement-banner')), findsOneWidget);
      expect(find.text('Eid hours'), findsOneWidget);
      expect(find.text('app'), findsOneWidget);

      await tester.tap(find.byKey(const Key('announcement-dismiss')));
      await tester.pump();
      expect(find.byKey(const Key('announcement-banner')), findsNothing);

      // Remembered on the phone, so it stays closed on the next launch.
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(dismissedAnnouncementPreferenceKey), isNotNull);
    });

    testWidgets('a closed announcement stays closed on a new launch, and returns when its text changes', (tester) async {
      final key = PlatformNotices.fromData(
        _data(announcement: true, announcementEn: 'Eid hours', audience: 'customers'),
      ).announcementKey;
      await open(tester, role: UserRole.customer, prefs: {dismissedAnnouncementPreferenceKey: key});
      await send(tester, _data(announcement: true, announcementEn: 'Eid hours', audience: 'customers'));
      expect(find.byKey(const Key('announcement-banner')), findsNothing);

      await send(tester, _data(announcement: true, announcementEn: 'New hours', audience: 'customers'));
      expect(find.byKey(const Key('announcement-banner')), findsOneWidget);
    });

    testWidgets('is not shown to people it is not meant for', (tester) async {
      await open(tester, role: UserRole.companyAdmin);
      await send(tester, _data(announcement: true, announcementEn: 'For customers', audience: 'customers'));
      expect(find.byKey(const Key('announcement-banner')), findsNothing);
      await send(tester, _data(announcement: true, announcementEn: 'For companies', audience: 'companies'));
      expect(find.text('For companies'), findsOneWidget);
    });

    testWidgets('someone signed out only sees what is for everyone', (tester) async {
      await open(tester, role: null);
      await send(tester, _data(announcement: true, announcementEn: 'For customers', audience: 'customers'));
      expect(find.byKey(const Key('announcement-banner')), findsNothing);
      await send(tester, _data(announcement: true, announcementEn: 'For all', audience: 'all'));
      expect(find.text('For all'), findsOneWidget);
    });

    testWidgets('the banner coming and going does not restart the app', (tester) async {
      await open(tester, role: UserRole.customer);
      await tester.tap(find.byKey(const Key('counter')));
      await tester.pump();
      await send(tester, _data(announcement: true, announcementEn: 'Hello'));
      expect(find.text('taps: 1'), findsOneWidget);
      await send(tester, _data());
      expect(find.text('taps: 1'), findsOneWidget);
    });

    Future<void> tick(WidgetTester tester, DateTime time) async {
      clock.add(time);
      await tester.pump();
      await tester.pump();
    }

    testWidgets('a scheduled maintenance waits for its start and ends by itself', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(
        tester,
        _data(
          maintenance: true,
          maintenanceEn: 'Upgrading',
          maintenanceStarts: DateTime(2026, 10, 5, 10),
          maintenanceEnds: DateTime(2026, 10, 5, 12),
        ),
      );
      await tick(tester, DateTime(2026, 10, 5, 9, 30));
      expect(find.byKey(const Key('maintenance-screen')), findsNothing);
      await tick(tester, DateTime(2026, 10, 5, 10, 0, 1));
      expect(find.byKey(const Key('maintenance-screen')), findsOneWidget);
      await tick(tester, DateTime(2026, 10, 5, 12));
      expect(find.byKey(const Key('maintenance-screen')), findsNothing);
      expect(find.text('app'), findsOneWidget);
    });

    testWidgets('maintenance says when it expects to be back and how long that is', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(
        tester,
        _data(maintenance: true, maintenanceEn: 'Upgrading', maintenanceEnds: DateTime(2026, 10, 5, 15)),
      );
      await tick(tester, DateTime(2026, 10, 5, 12, 45));
      expect(find.byKey(const Key('maintenance-back-at')), findsOneWidget);
      expect(find.textContaining('Expected back:'), findsOneWidget);
      expect(find.text('That is in about 2 h 15 min.'), findsOneWidget);
      expect(find.text('Please try again in a little while.'), findsNothing);

      await tick(tester, DateTime(2026, 10, 5, 14, 20));
      expect(find.text('That is in about 40 minutes.'), findsOneWidget);
      await tick(tester, DateTime(2026, 10, 5, 14, 59, 30));
      expect(find.text('That is in about 1 minute.'), findsOneWidget);
    });

    testWidgets('without an end time it keeps the plain "try again later"', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(tester, _data(maintenance: true, maintenanceEn: 'Upgrading'));
      expect(find.byKey(const Key('maintenance-back-at')), findsNothing);
      expect(find.text('Please try again in a little while.'), findsOneWidget);
    });

    testWidgets('counts days when it is far away', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(tester, _data(maintenance: true, maintenanceEn: 'Upgrading', maintenanceEnds: DateTime(2026, 10, 9, 12)));
      await tick(tester, DateTime(2026, 10, 5, 12));
      expect(find.text('That is in about 4 days.'), findsOneWidget);
    });

    testWidgets('maintenance can offer a status or support page', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(
        tester,
        _data(
          maintenance: true,
          maintenanceEn: 'Upgrading',
          maintenanceLink: 'https://status.example.com',
          maintenanceLabelEn: 'Status page',
        ),
      );
      await tester.tap(find.byKey(const Key('maintenance-link')));
      await tester.pump();
      expect(opened, [Uri.parse('https://status.example.com')]);
      expect(find.text('Status page'), findsOneWidget);
    });

    testWidgets('a link that is not https is never offered', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(
        tester,
        _data(maintenance: true, maintenanceEn: 'Upgrading', maintenanceLink: 'http://status.example.com', maintenanceLabelEn: 'Status page'),
      );
      expect(find.byKey(const Key('maintenance-link')), findsNothing);
    });

    testWidgets('a scheduled announcement appears and disappears at its times', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(
        tester,
        _data(
          announcement: true,
          announcementEn: 'Sale',
          announcementStarts: DateTime(2026, 10, 5, 8),
          announcementEnds: DateTime(2026, 10, 5, 18),
        ),
      );
      await tick(tester, DateTime(2026, 10, 5, 7));
      expect(find.byKey(const Key('announcement-banner')), findsNothing);
      await tick(tester, DateTime(2026, 10, 5, 9));
      expect(find.byKey(const Key('announcement-banner')), findsOneWidget);
      await tick(tester, DateTime(2026, 10, 5, 18, 1));
      expect(find.byKey(const Key('announcement-banner')), findsNothing);
    });

    testWidgets('each kind has its own icon', (tester) async {
      await open(tester, role: UserRole.customer);
      for (final kind in ['info', 'warning', 'success']) {
        await send(tester, _data(announcement: true, announcementEn: 'Hello $kind', kind: kind));
        expect(find.byKey(Key('announcement-$kind')), findsOneWidget, reason: kind);
        for (final other in ['info', 'warning', 'success'].where((k) => k != kind)) {
          expect(find.byKey(Key('announcement-$other')), findsNothing, reason: '$kind shows $other');
        }
      }
    });

    testWidgets('an announcement\'s button opens its page', (tester) async {
      await open(tester, role: UserRole.customer, locale: const Locale('ar'));
      await send(
        tester,
        _data(
          announcement: true,
          announcementAr: 'عرض',
          announcementLink: 'https://example.com/offers',
          announcementLabelAr: 'شاهد العروض',
          announcementLabelEn: 'See offers',
        ),
      );
      expect(find.text('شاهد العروض'), findsOneWidget);
      await tester.tap(find.byKey(const Key('announcement-link')));
      await tester.pump();
      expect(opened, [Uri.parse('https://example.com/offers')]);
    });

    testWidgets('an announcement with no link has no button', (tester) async {
      await open(tester, role: UserRole.customer);
      await send(tester, _data(announcement: true, announcementEn: 'Plain'));
      expect(find.byKey(const Key('announcement-link')), findsNothing);
    });

    testWidgets('an app below the lowest build is stopped on the update screen', (tester) async {
      await open(tester, role: UserRole.customer, build: 5);
      await send(tester, _data(minBuild: 6, updateUrl: 'https://example.com/app.apk'));
      expect(find.byKey(const Key('update-required-screen')), findsOneWidget);
      expect(find.text('Update required'), findsOneWidget);
      expect(find.text('A newer version of the app is needed to keep using it.'), findsOneWidget);
      await tester.tap(find.byKey(const Key('update-required-button')));
      await tester.pump();
      expect(opened, [Uri.parse('https://example.com/app.apk')]);
    });

    testWidgets('shows the admin\'s own message and speaks Arabic', (tester) async {
      await open(tester, role: UserRole.customer, build: 5, locale: const Locale('ar'));
      await send(tester, _data(minBuild: 6, updateUrl: 'https://example.com/app.apk', updateAr: 'حدّث الآن', updateEn: 'Update now'));
      expect(find.text('حدّث الآن'), findsOneWidget);
      expect(find.text('تحديث مطلوب'), findsOneWidget);
      expect(find.text('تحديث'), findsOneWidget);
    });

    testWidgets('lets an app at or above the lowest build through', (tester) async {
      await open(tester, role: UserRole.customer, build: 6);
      await send(tester, _data(minBuild: 6, updateUrl: 'https://example.com/app.apk'));
      expect(find.byKey(const Key('update-required-screen')), findsNothing);
      expect(find.text('app'), findsOneWidget);
    });

    testWidgets('never stops an app whose build cannot be read', (tester) async {
      await open(tester, role: UserRole.customer, build: null);
      await send(tester, _data(minBuild: 6, updateUrl: 'https://example.com/app.apk'));
      expect(find.byKey(const Key('update-required-screen')), findsNothing);
    });

    testWidgets('does nothing when no update is required', (tester) async {
      await open(tester, role: UserRole.customer, build: 1);
      await send(tester, _data());
      expect(find.byKey(const Key('update-required-screen')), findsNothing);
    });

    testWidgets('a Platform Admin is never stopped', (tester) async {
      await open(tester, role: UserRole.platformAdmin, build: 1);
      await send(tester, _data(minBuild: 6, updateUrl: 'https://example.com/app.apk'));
      expect(find.byKey(const Key('update-required-screen')), findsNothing);
    });

    testWidgets('reaches people who are signed out, and covers maintenance', (tester) async {
      await open(tester, role: null, build: 5);
      await send(
        tester,
        _data(maintenance: true, maintenanceEn: 'Upgrading', minBuild: 6, updateUrl: 'https://example.com/app.apk'),
      );
      expect(find.byKey(const Key('update-required-screen')), findsOneWidget);
      // Maintenance is underneath, not instead.
      expect(find.byKey(const Key('maintenance-screen')), findsOneWidget);
    });

    testWidgets('without a usable download page there is no button, but the app is still stopped', (tester) async {
      await open(tester, role: UserRole.customer, build: 5);
      await send(tester, _data(minBuild: 6, updateUrl: 'http://example.com/app.apk'));
      expect(find.byKey(const Key('update-required-screen')), findsOneWidget);
      expect(find.byKey(const Key('update-required-button')), findsNothing);
    });
  });
}

/// A stand-in for the whole app: it remembers taps, so a restart is visible.
class _Counter extends StatefulWidget {
  const _Counter();

  @override
  State<_Counter> createState() => _CounterState();
}

class _CounterState extends State<_Counter> {
  int taps = 0;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Column(
          children: [
            const Text('app'),
            TextButton(
              key: const Key('counter'),
              onPressed: () => setState(() => taps++),
              child: Text('taps: $taps'),
            ),
          ],
        ),
      );
}

class _Profile extends ProfileController {
  _Profile(this.role);

  final UserRole? role;

  @override
  Future<UserProfile?> build() async => role == null
      ? null
      : UserProfile(
          id: 'u1',
          fullName: 'Test',
          email: 't@x.test',
          role: role!,
          createdAt: DateTime(2026),
          isActive: true,
        );
}
