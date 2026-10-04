import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sudan_it_marketplace/core/localization/locale_controller.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/usage/domain/usage_repository.dart';
import 'package:sudan_it_marketplace/features/usage/presentation/usage_providers.dart';

class _FakeUsage implements UsageRepository {
  final days = <String>[];
  final views = <String>[];
  Object? failWith;

  @override
  Future<void> recordActiveDay({
    required String day,
    required String userId,
    required String role,
  }) async {
    if (failWith != null) throw failWith!;
    days.add('$day|$userId|$role');
  }

  @override
  Future<void> recordProductView(String productId) async {
    if (failWith != null) throw failWith!;
    views.add(productId);
  }
}

class _FakeProfile extends ProfileController {
  _FakeProfile(this._profile);

  final UserProfile? _profile;

  @override
  Future<UserProfile?> build() async => _profile;
}

UserProfile _person(UserRole role, {String id = 'u1', bool active = true}) =>
    UserProfile(
      id: id,
      fullName: 'Sara',
      email: 'sara@example.test',
      role: role,
      createdAt: DateTime(2026),
      isActive: active,
    );

Future<(ProviderContainer, _FakeUsage, UsageTracker)> _setup(
  UserProfile? profile, {
  Map<String, Object> stored = const {},
}) async {
  SharedPreferences.setMockInitialValues(stored);
  final prefs = await SharedPreferences.getInstance();
  final usage = _FakeUsage();
  final container = ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      usageRepositoryProvider.overrideWithValue(usage),
      profileControllerProvider.overrideWith(() => _FakeProfile(profile)),
    ],
  );
  addTearDown(container.dispose);
  return (container, usage, container.read(usageTrackerProvider));
}

void main() {
  group('the day', () {
    test('is written year-month-day with zeros, in the phone\'s calendar', () {
      expect(usageDayOf(DateTime(2026, 10, 4)), '2026-10-04');
      expect(usageDayOf(DateTime(2026, 1, 9, 23, 59)), '2026-01-09');
    });
  });

  group('opening the app', () {
    test('is recorded once a day for each person, with their role', () async {
      final (_, usage, tracker) = await _setup(null);
      final sara = _person(UserRole.customer);
      await tracker.appOpened(sara, now: DateTime(2026, 10, 4, 9));
      await tracker.appOpened(sara, now: DateTime(2026, 10, 4, 21));
      expect(usage.days, ['2026-10-04|u1|customer']);
      await tracker.appOpened(sara, now: DateTime(2026, 10, 5, 8));
      expect(usage.days, ['2026-10-04|u1|customer', '2026-10-05|u1|customer']);
    });

    test('a second person on the same phone is counted on their own', () async {
      final (_, usage, tracker) = await _setup(null);
      await tracker.appOpened(_person(UserRole.customer), now: DateTime(2026, 10, 4));
      await tracker.appOpened(
        _person(UserRole.companyAdmin, id: 'u2'),
        now: DateTime(2026, 10, 4),
      );
      expect(usage.days, ['2026-10-04|u1|customer', '2026-10-04|u2|company_admin']);
    });

    test('a Platform Admin or a deactivated account is not recorded', () async {
      final (_, usage, tracker) = await _setup(null);
      await tracker.appOpened(_person(UserRole.platformAdmin), now: DateTime(2026, 10, 4));
      await tracker.appOpened(_person(UserRole.customer, active: false), now: DateTime(2026, 10, 4));
      expect(usage.days, isEmpty);
    });

    test('when the network fails it tries again next time; the app never notices', () async {
      final (_, usage, tracker) = await _setup(null);
      usage.failWith = FirebaseException(plugin: 'cloud_firestore', code: 'unavailable');
      await tracker.appOpened(_person(UserRole.customer), now: DateTime(2026, 10, 4));
      expect(usage.days, isEmpty);
      usage.failWith = null;
      await tracker.appOpened(_person(UserRole.customer), now: DateTime(2026, 10, 4));
      expect(usage.days, hasLength(1));
    });

    test('"already recorded" (refused by the rules) is not retried all day', () async {
      final (_, usage, tracker) = await _setup(null);
      usage.failWith = FirebaseException(plugin: 'cloud_firestore', code: 'permission-denied');
      await tracker.appOpened(_person(UserRole.customer), now: DateTime(2026, 10, 4));
      usage.failWith = null;
      await tracker.appOpened(_person(UserRole.customer), now: DateTime(2026, 10, 4));
      expect(usage.days, isEmpty);
    });
  });

  group('opening a product', () {
    test('adds one view, once a day per product on this phone', () async {
      final (_, usage, tracker) = await _setup(_person(UserRole.customer));
      await tracker.productViewed('p1', now: DateTime(2026, 10, 4));
      await tracker.productViewed('p1', now: DateTime(2026, 10, 4));
      await tracker.productViewed('p2', now: DateTime(2026, 10, 4));
      expect(usage.views, ['p1', 'p2']);
      await tracker.productViewed('p1', now: DateTime(2026, 10, 5));
      expect(usage.views, ['p1', 'p2', 'p1']);
    });

    test('only a customer\'s views count', () async {
      for (final role in [UserRole.companyAdmin, UserRole.technician, UserRole.platformAdmin]) {
        final (_, usage, tracker) = await _setup(_person(role));
        await tracker.productViewed('p1', now: DateTime(2026, 10, 4));
        expect(usage.views, isEmpty, reason: role.name);
      }
      final (_, signedOut, tracker) = await _setup(null);
      await tracker.productViewed('p1', now: DateTime(2026, 10, 4));
      expect(signedOut.views, isEmpty);
    });

    test('a failed write is not remembered, so the next look counts', () async {
      final (_, usage, tracker) = await _setup(_person(UserRole.customer));
      usage.failWith = FirebaseException(plugin: 'cloud_firestore', code: 'unavailable');
      await tracker.productViewed('p1', now: DateTime(2026, 10, 4));
      usage.failWith = null;
      await tracker.productViewed('p1', now: DateTime(2026, 10, 4));
      expect(usage.views, ['p1']);
    });

    test('an empty product id is ignored', () async {
      final (_, usage, tracker) = await _setup(_person(UserRole.customer));
      await tracker.productViewed('', now: DateTime(2026, 10, 4));
      expect(usage.views, isEmpty);
    });
  });
}
