import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sudan_it_marketplace/core/localization/locale_controller.dart';
import 'package:sudan_it_marketplace/core/push/push_relay.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/notifications/data/models/app_notification_model.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/entities/app_notification.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notification_events.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notification_format.dart';
import 'package:sudan_it_marketplace/features/push/data/push_prefs_store.dart';
import 'package:sudan_it_marketplace/features/push/domain/push_categories.dart';
import 'package:sudan_it_marketplace/features/push/presentation/push_destination.dart';
import 'package:sudan_it_marketplace/features/push/presentation/push_preference.dart';
import 'package:sudan_it_marketplace/features/settings/presentation/settings_screen.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_ar.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations_en.dart';

class _Relay implements PushRelay {
  const _Relay();

  @override
  bool get isEnabled => true;

  @override
  Future<void> notification(String notificationId) async {}

  @override
  Future<void> chatMessage({
    required String chatId,
    required String messageId,
  }) async {}
}

class _Profile extends ProfileController {
  _Profile(this.role);

  final UserRole role;

  @override
  Future<UserProfile?> build() async => UserProfile(
        id: 'u1',
        fullName: 'Test',
        email: 't@x.test',
        role: role,
        createdAt: DateTime(2026),
        isActive: true,
      );
}

/// Stands in for Firestore: remembers what was saved and feeds it back.
class _Store extends FirestorePushPrefs {
  _Store([Map<String, bool> initial = const {}])
      : _off = {
          for (final e in initial.entries)
            if (!e.value) e.key,
        },
        super(firestore: null);

  final Set<String> _off;
  final saved = <(String, PushCategory, bool)>[];
  final _controller = StreamController<PushPrefs>.broadcast();

  @override
  Stream<PushPrefs> watch(String uid) async* {
    yield PushPrefs({..._off});
    yield* _controller.stream;
  }

  @override
  Future<void> set(String uid, PushCategory category, bool enabled) async {
    saved.add((uid, category, enabled));
    if (enabled) {
      _off.remove(category.key);
    } else {
      _off.add(category.key);
    }
    _controller.add(PushPrefs({..._off}));
  }
}

Future<Widget> _settings(
  UserRole role,
  _Store store, {
  bool masterOn = true,
  String language = 'en',
}) async {
  SharedPreferences.setMockInitialValues({'push_enabled': masterOn});
  final prefs = await SharedPreferences.getInstance();
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      pushRelayProvider.overrideWithValue(const _Relay()),
      profileControllerProvider.overrideWith(() => _Profile(role)),
      currentUserIdProvider.overrideWithValue('u1'),
      pushPrefsStoreProvider.overrideWithValue(store),
    ],
    child: MaterialApp(
      theme: AppTheme.light,
      locale: Locale(language),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const SettingsScreen(),
    ),
  );
}

/// A tall screen, so every row of the list is on it and can be tapped.
void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 3000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Finder _kind(PushCategory kind) =>
    find.byKey(ValueKey('settings-push-${kind.key}'));

UserProfile _profileOf(UserRole role, {String? companyId}) => UserProfile(
      id: 'u1',
      fullName: 'Sara',
      email: 's@example.test',
      role: role,
      createdAt: DateTime(2026),
      isActive: true,
      companyId: companyId,
    );

void main() {
  group('the kinds of push', () {
    test('each role sees only the kinds it can receive', () {
      expect(PushCategory.forRole(UserRole.customer), [
        PushCategory.orders,
        PushCategory.chat,
        PushCategory.serviceRequests,
        PushCategory.reports,
        PushCategory.cityAnnouncements,
      ]);
      expect(PushCategory.forRole(UserRole.companyAdmin), contains(PushCategory.platform));
      expect(PushCategory.forRole(UserRole.companyAdmin), isNot(contains(PushCategory.cityAnnouncements)));
      expect(PushCategory.forRole(UserRole.technician), [PushCategory.orders]);
      expect(PushCategory.forRole(UserRole.platformAdmin), isEmpty);
    });

    test('the keys are the ones the rules and the relay know', () {
      expect(
        PushCategory.values.map((c) => c.key).toSet(),
        {'orders', 'chat', 'serviceRequests', 'reports', 'platform', 'cityAnnouncements'},
      );
    });

    test('everything is on until switched off', () {
      const none = PushPrefs();
      for (final kind in PushCategory.values) {
        expect(none.isOn(kind), isTrue);
      }
      expect(PushPrefs.fromMap(null).isOn(PushCategory.orders), isTrue);
      expect(PushPrefs.fromMap('nonsense').isOn(PushCategory.orders), isTrue);
    });

    test('is read from the stored map, and only false means off', () {
      final prefs = PushPrefs.fromMap({'orders': false, 'chat': true, 'reports': 'no'});
      expect(prefs.isOn(PushCategory.orders), isFalse);
      expect(prefs.isOn(PushCategory.chat), isTrue);
      expect(prefs.isOn(PushCategory.reports), isTrue);
    });

    test('changing one leaves the others', () {
      final prefs = const PushPrefs()
          .withKind(PushCategory.chat, enabled: false)
          .withKind(PushCategory.orders, enabled: false)
          .withKind(PushCategory.chat, enabled: true);
      expect(prefs.isOn(PushCategory.orders), isFalse);
      expect(prefs.isOn(PushCategory.chat), isTrue);
      expect(prefs.toMap()['orders'], isFalse);
      expect(prefs.toMap()['chat'], isTrue);
    });
  });

  group('the switches in Settings', () {
    testWidgets('a customer sees the five kinds, all on, and no platform messages', (tester) async {
      _tall(tester);
      await tester.pumpWidget(await _settings(UserRole.customer, _Store()));
      await tester.pumpAndSettle();
      for (final kind in PushCategory.forRole(UserRole.customer)) {
        expect(_kind(kind), findsOneWidget, reason: kind.key);
      }
      expect(_kind(PushCategory.platform), findsNothing);
      expect(find.text('WHAT TO BE NOTIFIED ABOUT'), findsOneWidget);
      expect(find.text('Orders'), findsOneWidget);
      expect(find.text('New companies in my city'), findsOneWidget);
    });

    testWidgets('a company admin sees platform messages, not the city kind', (tester) async {
      _tall(tester);
      await tester.pumpWidget(await _settings(UserRole.companyAdmin, _Store()));
      await tester.pumpAndSettle();
      expect(_kind(PushCategory.platform), findsOneWidget);
      expect(_kind(PushCategory.cityAnnouncements), findsNothing);
    });

    testWidgets('a technician sees orders only', (tester) async {
      _tall(tester);
      await tester.pumpWidget(await _settings(UserRole.technician, _Store()));
      await tester.pumpAndSettle();
      expect(_kind(PushCategory.orders), findsOneWidget);
      expect(_kind(PushCategory.chat), findsNothing);
    });

    testWidgets('turning one off saves that one kind, and shows it off', (tester) async {
      final store = _Store();
      _tall(tester);
      await tester.pumpWidget(await _settings(UserRole.customer, store));
      await tester.pumpAndSettle();

      await tester.tap(_kind(PushCategory.chat));
      await tester.pumpAndSettle();

      expect(store.saved, [('u1', PushCategory.chat, false)]);
      final toggle = tester.widget<Switch>(
        find.descendant(of: _kind(PushCategory.chat), matching: find.byType(Switch)),
      );
      expect(toggle.value, isFalse);
      // The others stay on.
      final orders = tester.widget<Switch>(
        find.descendant(of: _kind(PushCategory.orders), matching: find.byType(Switch)),
      );
      expect(orders.value, isTrue);
    });

    testWidgets('shows what was saved before, and turns it back on', (tester) async {
      final store = _Store({'reports': false});
      _tall(tester);
      await tester.pumpWidget(await _settings(UserRole.customer, store));
      await tester.pumpAndSettle();
      Switch reports() => tester.widget<Switch>(
            find.descendant(of: _kind(PushCategory.reports), matching: find.byType(Switch)),
          );
      expect(reports().value, isFalse);
      await tester.tap(_kind(PushCategory.reports));
      await tester.pumpAndSettle();
      expect(store.saved.single.$3, isTrue);
      expect(reports().value, isTrue);
    });

    testWidgets('are hidden while the phone notifications switch is off', (tester) async {
      _tall(tester);
      await tester.pumpWidget(await _settings(UserRole.customer, _Store(), masterOn: false));
      await tester.pumpAndSettle();
      expect(_kind(PushCategory.orders), findsNothing);
      expect(find.text('WHAT TO BE NOTIFIED ABOUT'), findsNothing);
    });

    testWidgets('read in Arabic', (tester) async {
      _tall(tester);
      await tester.pumpWidget(await _settings(UserRole.customer, _Store(), language: 'ar'));
      await tester.pumpAndSettle();
      expect(find.text('الطلبات'), findsOneWidget);
      expect(find.text('شركات جديدة في مدينتي'), findsOneWidget);
    });
  });

  group('what the platform did', () {
    AppNotification note(String type, {String productId = '', String orderId = ''}) =>
        AppNotification(
          id: 'n1',
          recipientType: NotificationRecipientType.companyAdmin,
          recipientId: 'c1',
          orderId: orderId,
          productId: productId,
          type: type,
          productName: 'Router',
          createdAt: DateTime(2026, 10, 10),
        );

    test('a product notification keeps its product id, and no text of its own', () {
      final read = AppNotificationModel.fromMap('n1', {
        'recipientType': 'company_admin',
        'recipientId': 'c1',
        'productId': 'p1',
        'type': 'product_hidden',
        'productName': 'Router',
        'title': 'ignored',
      });
      expect(read.productId, 'p1');
      expect(read.orderId, isEmpty);
      expect(AppNotificationModel.toFirestoreCreateMap(read)['productId'], 'p1');
    });

    test('is worded from its type and the name, in English and Arabic', () {
      final en = AppLocalizationsEn();
      final ar = AppLocalizationsAr();
      for (final type in [
        NotificationTypes.orderCancelledByAdmin,
        NotificationTypes.orderCancelledByAdminCompany,
        NotificationTypes.productHidden,
        NotificationTypes.productShown,
        NotificationTypes.accountConvertedToCompany,
      ]) {
        final n = note(type);
        expect(NotificationFormat.title(en, n), isNot(en.notifGenericTitle), reason: type);
        expect(NotificationFormat.title(ar, n), isNot(ar.notifGenericTitle), reason: type);
        expect(NotificationFormat.body(en, n), contains('Router'), reason: type);
        expect(NotificationFormat.body(ar, n), contains('Router'), reason: type);
      }
    });

    test('a cancelled order opens the order, a product opens the product', () {
      final company = _profileOf(UserRole.companyAdmin, companyId: 'c1');
      expect(
        pushDestination({
          'type': 'order_cancelled_by_admin_company',
          'orderId': 'o1',
          'recipientType': 'company_admin',
        }, company),
        isA<CompanyOrderDestination>(),
      );
      final product = pushDestination({
        'type': 'product_hidden',
        'productId': 'p1',
        'recipientType': 'company_admin',
      }, company);
      expect(product, isA<CompanyProductDestination>());
      expect((product! as CompanyProductDestination).productId, 'p1');
      expect((product as CompanyProductDestination).companyId, 'c1');
      expect(
        pushDestination({
          'type': 'order_cancelled_by_admin',
          'orderId': 'o1',
          'recipientType': 'customer',
        }, _profileOf(UserRole.customer)),
        isA<CustomerOrderDestination>(),
      );
    });

    test('the push for an account turned into a company opens only the app', () {
      expect(
        pushDestination({
          'type': 'account_converted_to_company',
          'orderId': '',
          'recipientType': 'company_admin',
        }, _profileOf(UserRole.companyAdmin)),
        isNull,
      );
    });

    test('a product push is meant for its company only', () {
      expect(
        pushDestination({
          'type': 'product_hidden',
          'productId': 'p1',
          'recipientType': 'company_admin',
        }, _profileOf(UserRole.customer)),
        isNull,
      );
    });
  });
}
