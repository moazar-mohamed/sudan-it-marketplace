import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/localization/locale_controller.dart';
import '../domain/platform_notices.dart';

/// Where the dismissed announcement is remembered on this phone.
const dismissedAnnouncementPreferenceKey = 'dismissed_announcement';

/// The live notices the Platform Admin set (`platform_settings/public`). The
/// document is readable before sign-in. While it loads, or if it cannot be
/// read, callers treat it as "nothing to show".
final platformNoticesProvider = StreamProvider<PlatformNotices>((ref) {
  return FirebaseFirestore.instance
      .doc('platform_settings/public')
      .snapshots()
      .map((snapshot) => PlatformNotices.fromData(snapshot.data()));
});

/// The time, refreshed twice a minute, for notices that start or stop at a set
/// time (and the "back in ..." countdown). Only watched while one exists.
final noticeClockProvider = StreamProvider<DateTime>((ref) async* {
  yield DateTime.now();
  yield* Stream.periodic(const Duration(seconds: 30), (_) => DateTime.now());
});

/// This app's build number (the number after the + in the version), or null
/// when it cannot be read, in which case nobody is asked to update.
final appBuildNumberProvider = FutureProvider<int?>((ref) async {
  try {
    final info = await PackageInfo.fromPlatform();
    return int.tryParse(info.buildNumber);
  } catch (_) {
    return null;
  }
});

/// Opens a page from a notice's button in the browser; false if it could not.
typedef NoticeLinkOpener = Future<bool> Function(Uri uri);

final noticeLinkOpenerProvider = Provider<NoticeLinkOpener>((ref) {
  return (uri) async {
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  };
});

/// The announcement this phone's user closed (its [PlatformNotices.announcementKey]).
final dismissedAnnouncementProvider =
    NotifierProvider<DismissedAnnouncementController, String?>(
      DismissedAnnouncementController.new,
    );

class DismissedAnnouncementController extends Notifier<String?> {
  @override
  String? build() => ref
      .read(sharedPreferencesProvider)
      ?.getString(dismissedAnnouncementPreferenceKey);

  Future<void> dismiss(String announcementKey) async {
    state = announcementKey;
    await ref
        .read(sharedPreferencesProvider)
        ?.setString(dismissedAnnouncementPreferenceKey, announcementKey);
  }
}
