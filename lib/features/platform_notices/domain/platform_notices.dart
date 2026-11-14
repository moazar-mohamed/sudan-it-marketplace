import 'package:cloud_firestore/cloud_firestore.dart';

import '../../auth/domain/entities/user_role.dart';

/// Who an announcement is for.
enum NoticeAudience {
  all,
  customers,
  companies;

  static NoticeAudience parse(Object? value) {
    for (final audience in values) {
      if (audience.name == value) return audience;
    }
    return NoticeAudience.all;
  }
}

/// How an announcement looks: information, a warning or good news.
enum AnnouncementKind {
  info,
  warning,
  success;

  static AnnouncementKind parse(Object? value) {
    for (final kind in values) {
      if (kind.name == value) return kind;
    }
    return AnnouncementKind.info;
  }
}

/// A button under a notice that opens a web page, with a label in each
/// language. Only an https link counts: anything else is ignored, so a mistake
/// in the document can never open something else.
class NoticeLink {
  const NoticeLink({this.url = '', this.labelAr = '', this.labelEn = ''});

  factory NoticeLink.fromData(Map<Object?, Object?> map) => NoticeLink(
        url: PlatformNotice._text(map['linkUrl']),
        labelAr: PlatformNotice._text(map['linkLabelAr']),
        labelEn: PlatformNotice._text(map['linkLabelEn']),
      );

  final String url;
  final String labelAr;
  final String labelEn;

  /// The page to open, or null when there is no (valid https) link.
  Uri? get uri {
    final parsed = Uri.tryParse(url);
    if (parsed == null || parsed.scheme != 'https' || parsed.host.isEmpty) {
      return null;
    }
    return parsed;
  }

  /// The button's label for a reader of [languageCode], falling back to the
  /// other language; null when there is no usable link or no label.
  String? labelFor(String languageCode) {
    if (uri == null) return null;
    final preferred = languageCode == 'ar' ? labelAr : labelEn;
    final other = languageCode == 'ar' ? labelEn : labelAr;
    if (preferred.isNotEmpty) return preferred;
    return other.isNotEmpty ? other : null;
  }
}

/// One notice the Platform Admin can switch on from the dashboard: an Arabic
/// and an English text, shown in the reader's language, between an optional
/// start and end time, with an optional button.
class PlatformNotice {
  const PlatformNotice({
    this.enabled = false,
    this.messageAr = '',
    this.messageEn = '',
    this.startsAt,
    this.endsAt,
    this.link = const NoticeLink(),
  });

  factory PlatformNotice.fromData(Object? data) {
    final map = data is Map ? data : const {};
    return PlatformNotice(
      enabled: map['enabled'] == true,
      messageAr: _text(map['messageAr']),
      messageEn: _text(map['messageEn']),
      startsAt: _time(map['startsAt']),
      endsAt: _time(map['endsAt']),
      link: NoticeLink.fromData(map),
    );
  }

  final bool enabled;
  final String messageAr;
  final String messageEn;

  /// null = from the moment it is switched on.
  final DateTime? startsAt;

  /// null = until it is switched off.
  final DateTime? endsAt;
  final NoticeLink link;

  bool get hasSchedule => startsAt != null || endsAt != null;

  /// Whether the notice is on and inside its schedule at [now]: it starts at
  /// [startsAt] and is over at [endsAt]. The same rule as the dashboard's.
  bool isActiveAt(DateTime now) {
    if (!enabled) return false;
    final start = startsAt;
    if (start != null && now.isBefore(start)) return false;
    final end = endsAt;
    if (end != null && !now.isBefore(end)) return false;
    return true;
  }

  /// The text for a reader of [languageCode] ('ar' or 'en'), falling back to
  /// the other language when theirs is empty. Null when the notice is off, has
  /// no text at all or, when [now] is given, is outside its schedule.
  String? textFor(String languageCode, {DateTime? now}) {
    if (!enabled) return null;
    if (now != null && !isActiveAt(now)) return null;
    final preferred = languageCode == 'ar' ? messageAr : messageEn;
    final other = languageCode == 'ar' ? messageEn : messageAr;
    if (preferred.isNotEmpty) return preferred;
    return other.isNotEmpty ? other : null;
  }

  static String _text(Object? value) => value is String ? value.trim() : '';

  static DateTime? _time(Object? value) {
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }
}

/// The lowest app build that may still be used. An app with a smaller build
/// number is stopped on an "update required" screen.
class RequiredUpdate {
  const RequiredUpdate({
    this.minBuild = 0,
    this.url = '',
    this.messageAr = '',
    this.messageEn = '',
  });

  factory RequiredUpdate.fromData(Object? data) {
    final map = data is Map ? data : const {};
    final build = map['minBuild'];
    return RequiredUpdate(
      minBuild: build is int && build > 0 ? build : 0,
      url: PlatformNotice._text(map['url']),
      messageAr: PlatformNotice._text(map['messageAr']),
      messageEn: PlatformNotice._text(map['messageEn']),
    );
  }

  final int minBuild;
  final String url;
  final String messageAr;
  final String messageEn;

  /// Whether an app with this [build] number must update. An unknown build
  /// (the number could not be read) is never stopped: a broken lookup must not
  /// lock anyone out.
  bool isRequiredFor(int? build) => build != null && minBuild > build;

  /// The page the update comes from, or null if it is not a usable https link.
  Uri? get uri => NoticeLink(url: url).uri;

  /// The admin's message for a reader of [languageCode], falling back to the
  /// other language; null when none was written (the app has its own words).
  String? textFor(String languageCode) {
    final preferred = languageCode == 'ar' ? messageAr : messageEn;
    final other = languageCode == 'ar' ? messageEn : messageAr;
    if (preferred.isNotEmpty) return preferred;
    return other.isNotEmpty ? other : null;
  }
}

/// What `platform_settings/public` says: a maintenance notice (the app shows
/// it instead of itself), an announcement banner for some audience, and the
/// lowest app build that may be used.
class PlatformNotices {
  const PlatformNotices({
    this.maintenance = const PlatformNotice(),
    this.announcement = const PlatformNotice(),
    this.audience = NoticeAudience.all,
    this.announcementKind = AnnouncementKind.info,
    this.update = const RequiredUpdate(),
  });

  /// Nothing to show; also what the app assumes when the document is missing
  /// or cannot be read, so a broken connection never locks anyone out.
  static const none = PlatformNotices();

  factory PlatformNotices.fromData(Map<String, dynamic>? data) {
    if (data == null) return none;
    final announcement = data['announcement'];
    return PlatformNotices(
      maintenance: PlatformNotice.fromData(data['maintenance']),
      announcement: PlatformNotice.fromData(announcement),
      audience: NoticeAudience.parse(announcement is Map ? announcement['audience'] : null),
      announcementKind: AnnouncementKind.parse(announcement is Map ? announcement['kind'] : null),
      update: RequiredUpdate.fromData(data['update']),
    );
  }

  final PlatformNotice maintenance;
  final PlatformNotice announcement;
  final NoticeAudience audience;
  final AnnouncementKind announcementKind;
  final RequiredUpdate update;

  /// Whether anything here starts or stops at a set time, so the app needs a
  /// clock to know when to show or hide it.
  bool get hasSchedule => maintenance.hasSchedule || announcement.hasSchedule;

  /// Whether the announcement is for someone with this [role] (null while
  /// signed out, who only see announcements meant for everyone).
  bool announcementIsFor(UserRole? role) => switch (audience) {
        NoticeAudience.all => true,
        NoticeAudience.customers => role == UserRole.customer,
        NoticeAudience.companies =>
          role == UserRole.companyAdmin || role == UserRole.technician,
      };

  /// Identifies the announcement's content, so a person who dismissed it does
  /// not see it again until what it says (or where it points) changes.
  String get announcementKey =>
      '${audience.name}|${announcementKind.name}|${announcement.messageAr}|${announcement.messageEn}|${announcement.link.url}';
}
