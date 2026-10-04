import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/locale_controller.dart';
import '../../auth/domain/entities/user_profile.dart';
import '../../auth/domain/entities/user_role.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../data/firestore_usage_repository.dart';
import '../domain/usage_repository.dart';

final usageRepositoryProvider = Provider<UsageRepository>((ref) {
  return FirestoreUsageRepository();
});

final usageTrackerProvider = Provider<UsageTracker>((ref) => UsageTracker(ref));

/// `2026-10-04`, in the phone's own calendar.
String usageDayOf(DateTime time) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${time.year.toString().padLeft(4, '0')}-${two(time.month)}-${two(time.day)}';
}

/// Tells the platform that the app was opened, and which products were looked
/// at, so the Platform Admin can see use over time. It is best effort and
/// never shown: a failure here must never touch what the person is doing, and
/// each thing is sent at most once a day from a phone (remembered on the
/// phone), so it costs a handful of writes.
class UsageTracker {
  UsageTracker(this._ref);

  final Ref _ref;

  static const _viewsKey = 'usage_views';
  static String _dayKey(String userId) => 'usage_day_$userId';

  /// [profile] opened the app today (once a day per person).
  Future<void> appOpened(UserProfile profile, {DateTime? now}) async {
    if (!profile.isActive || profile.role == UserRole.platformAdmin) return;
    try {
      final day = usageDayOf(now ?? DateTime.now());
      final prefs = _ref.read(sharedPreferencesProvider);
      if (prefs?.getString(_dayKey(profile.id)) == day) return;
      try {
        await _ref.read(usageRepositoryProvider).recordActiveDay(
              day: day,
              userId: profile.id,
              role: profile.role.firestoreValue,
            );
      } on FirebaseException catch (error) {
        // "permission-denied" here means today was already recorded (or this
        // account may not record); either way there is nothing to retry.
        if (error.code != 'permission-denied') rethrow;
      }
      await prefs?.setString(_dayKey(profile.id), day);
    } catch (_) {}
  }

  /// A customer opened [productId] (once a day per product on this phone).
  Future<void> productViewed(String productId, {DateTime? now}) async {
    if (productId.isEmpty) return;
    try {
      final profile = await _ref.read(profileControllerProvider.future);
      if (profile == null ||
          !profile.isActive ||
          profile.role != UserRole.customer) {
        return;
      }
      final day = usageDayOf(now ?? DateTime.now());
      final prefs = _ref.read(sharedPreferencesProvider);
      // Stored as "day|id,id,..." and started afresh each day.
      final stored = prefs?.getString(_viewsKey) ?? '';
      final separator = stored.indexOf('|');
      final storedDay = separator < 0 ? '' : stored.substring(0, separator);
      final seen = storedDay == day && separator >= 0
          ? stored.substring(separator + 1).split(',').where((id) => id.isNotEmpty).toSet()
          : <String>{};
      if (seen.contains(productId)) return;
      await _ref.read(usageRepositoryProvider).recordProductView(productId);
      seen.add(productId);
      await prefs?.setString(_viewsKey, '$day|${seen.join(',')}');
    } catch (_) {}
  }
}

/// Records the day's use once the signed-in profile is known, and again when
/// the app comes back after the day has changed. Watched once from the root.
final usageSyncProvider = Provider<void>((ref) {
  void record(UserProfile? profile) {
    if (profile != null) {
      ref.read(usageTrackerProvider).appOpened(profile);
    }
  }

  ref.listen<AsyncValue<UserProfile?>>(
    profileControllerProvider,
    (_, next) => record(next.asData?.value),
    fireImmediately: true,
  );

  final observer = _ResumeObserver(
    () => record(ref.read(profileControllerProvider).asData?.value),
  );
  WidgetsBinding.instance.addObserver(observer);
  ref.onDispose(() => WidgetsBinding.instance.removeObserver(observer));
});

class _ResumeObserver with WidgetsBindingObserver {
  _ResumeObserver(this._onResume);

  final VoidCallback _onResume;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _onResume();
  }
}
