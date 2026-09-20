import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sudan_it_marketplace/core/localization/app_locale.dart';
import 'package:sudan_it_marketplace/core/localization/locale_controller.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/auth_user.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_profile.dart';
import 'package:sudan_it_marketplace/features/auth/domain/entities/user_role.dart';
import 'package:sudan_it_marketplace/features/auth/domain/exceptions/auth_exception.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/auth_repository.dart';
import 'package:sudan_it_marketplace/features/auth/domain/repositories/user_profile_repository.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_controller.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/auth_providers.dart';
import 'package:sudan_it_marketplace/features/auth/presentation/language_sync.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/profile_controller.dart';
import 'package:sudan_it_marketplace/features/notifications/domain/entities/app_notification.dart';
import 'package:sudan_it_marketplace/features/notifications/presentation/notification_format.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_labels.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/settings/presentation/settings_screen.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';
import 'package:sudan_it_marketplace/main.dart';

const _authUser =
    AuthUser(id: 'u1', email: 'customer@example.test', emailVerified: true);

UserProfile _profile({String? language}) => UserProfile(
      id: 'u1',
      fullName: 'Moazer Mohamed',
      email: 'customer@example.test',
      role: UserRole.customer,
      createdAt: DateTime(2026),
      isActive: true,
      language: language,
    );

class _FakeAuth extends Fake implements AuthRepository {
  _FakeAuth({this.user, this.signInError});

  AuthUser? user;
  final AuthException? signInError;
  final _changes = StreamController<AuthUser?>.broadcast();

  @override
  Stream<AuthUser?> authStateChanges() async* {
    yield user;
    yield* _changes.stream;
  }

  @override
  AuthUser? get currentUser => user;

  @override
  Future<AuthUser> signInWithEmail({
    required String email,
    required String password,
  }) async {
    if (signInError != null) throw signInError!;
    user = _authUser;
    _changes.add(user);
    return _authUser;
  }

  @override
  Future<void> signOut() async {
    user = null;
    _changes.add(null);
  }
}

class _FakeProfiles extends Fake implements UserProfileRepository {
  _FakeProfiles(this.profile);

  UserProfile? profile;
  bool failSaving = false;
  final saved = <String>[];

  @override
  Future<UserProfile?> fetchOrCreateCustomerProfile({
    required String userId,
    required String fullName,
    required String email,
  }) async =>
      profile;

  @override
  Future<void> updateLanguage({
    required String userId,
    required String language,
  }) async {
    if (failSaving) {
      throw const AuthException('denied', code: 'permission-denied');
    }
    saved.add(language);
    profile = profile?.copyWith(language: language);
  }
}

Future<SharedPreferences> _prefs([Map<String, Object> values = const {}]) async {
  SharedPreferences.setMockInitialValues(values);
  return SharedPreferences.getInstance();
}

Widget _app({
  required SharedPreferences prefs,
  required _FakeAuth auth,
  required _FakeProfiles profiles,
}) {
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      authRepositoryProvider.overrideWithValue(auth),
      userProfileRepositoryProvider.overrideWithValue(profiles),
      signedInFirebaseUserProvider.overrideWith((ref) => null),
      firestoreProductsStreamProvider
          .overrideWith((ref) => Stream.value(const [])),
      firestoreCompaniesStreamProvider
          .overrideWith((ref) => Stream.value(const [])),
      customerOrdersStreamProvider
          .overrideWith((ref) => Stream.value(const [])),
    ],
    child: const SudanITMarketplaceApp(),
  );
}

TextDirection _direction(WidgetTester tester, Finder inside) =>
    Directionality.of(tester.element(inside));

/// A tall window, so the whole login form is on screen without scrolling.
void _tall(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

ProviderContainer _container(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));

void main() {
  group('translation files', () {
    Map<String, dynamic> load(String lang) => jsonDecode(
          File('lib/l10n/app_$lang.arb').readAsStringSync(),
        ) as Map<String, dynamic>;

    final en = load('en');
    final ar = load('ar');
    Iterable<String> messages(Map<String, dynamic> arb) =>
        arb.keys.where((k) => !k.startsWith('@'));
    final placeholder = RegExp(r'\{([A-Za-z_][A-Za-z0-9_]*)(?=[,}])');
    Set<String> placeholders(String text) =>
        placeholder.allMatches(text).map((m) => m.group(1)!).toSet();

    test('English and Arabic have exactly the same keys', () {
      expect(messages(ar).toSet(), messages(en).toSet());
    });

    test('no translation is empty', () {
      for (final key in messages(en)) {
        expect((en[key] as String).trim(), isNotEmpty, reason: 'en $key');
        expect((ar[key] as String).trim(), isNotEmpty, reason: 'ar $key');
      }
    });

    test('both languages use the same placeholders', () {
      for (final key in messages(en)) {
        expect(
          placeholders(ar[key] as String),
          placeholders(en[key] as String),
          reason: key,
        );
      }
    });

    test('Arabic strings are really translated', () {
      // Proper names and symbols that are written the same in both languages.
      const sameOnPurpose = {'languageEnglish', 'languageArabic', 'adminFilterStatus'};
      final arabicLetters = RegExp(r'[؀-ۿ]');
      for (final key in messages(en)) {
        final english = en[key] as String;
        if (sameOnPurpose.contains(key)) continue;
        if (RegExp(r'[A-Za-z]{3}').hasMatch(english)) {
          expect(arabicLetters.hasMatch(ar[key] as String), isTrue,
              reason: '$key is not translated');
        }
      }
    });

    test('key examples from the spec exist', () {
      for (final key in [
        'commonCancel', 'commonConfirm', 'commonDelete', 'commonSave',
        'commonEdit', 'commonLoading', 'commonSearch', 'commonLanguage',
        'authLogin', 'authEmail', 'authPassword', 'productPriceOnRequest',
        'adminAddTechnician', 'settingsTitle',
      ]) {
        expect(en.containsKey(key), isTrue, reason: key);
      }
    });

    test('the spec\'s reference Arabic wording is used', () {
      final l = lookupAppLocalizations(AppLocale.arabic);
      expect(l.productPriceOnRequest, 'السعر عند التواصل');
      expect(l.commonDelete, 'حذف');
      expect(l.commonDeactivate, 'إلغاء التفعيل');
      expect(l.commonConfirm, 'تأكيد');
      expect(l.commonCancel, 'إلغاء');
      expect(l.commonSave, 'حفظ');
      expect(l.settingsTitle, 'الإعدادات');
      expect(l.commonLanguage, 'اللغة');
      expect(l.languageEnglish, 'English');
      expect(l.languageArabic, 'العربية');
      expect(l.adminAddTechnician, 'إضافة فني');
    });

    test('plural forms work in Arabic', () {
      final l = lookupAppLocalizations(AppLocale.arabic);
      expect(l.reviewsCount(1), contains('مراجعة واحدة'));
      expect(l.reviewsCount(2), contains('مراجعتان'));
      expect(l.reviewsCount(5), contains('5 مراجعات'));
      expect(l.reviewsCount(12), contains('12 مراجعة'));
      final e = lookupAppLocalizations(AppLocale.english);
      expect(e.reviewsCount(1), '(1 review)');
      expect(e.reviewsCount(3), '(3 reviews)');
    });
  });

  group('language preference on the device', () {
    test('defaults to English when nothing was chosen', () async {
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(await _prefs()),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(localeControllerProvider), AppLocale.english);
    });

    test('starts in the language stored on the device', () async {
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider
              .overrideWithValue(await _prefs({'language': 'ar'})),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(localeControllerProvider), AppLocale.arabic);
    });

    test('ignores an unsupported stored value', () async {
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider
              .overrideWithValue(await _prefs({'language': 'fr'})),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(localeControllerProvider), AppLocale.english);
    });

    test('changing the language updates the state and is stored', () async {
      final prefs = await _prefs();
      final container = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);
      final controller = container.read(localeControllerProvider.notifier);

      await controller.setLocale(AppLocale.arabic);
      expect(container.read(localeControllerProvider), AppLocale.arabic);
      expect(prefs.getString('language'), 'ar');

      await controller.setLocale(AppLocale.english);
      expect(container.read(localeControllerProvider), AppLocale.english);
      expect(prefs.getString('language'), 'en');
    });

    test('an unsupported locale is ignored', () async {
      final prefs = await _prefs();
      final container = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);
      await container
          .read(localeControllerProvider.notifier)
          .setLocale(const Locale('fr'));
      expect(container.read(localeControllerProvider), AppLocale.english);
      expect(prefs.getString('language'), isNull);
    });

    test('works without storage (nothing is remembered, nothing breaks)', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(container.read(localeControllerProvider), AppLocale.english);
    });
  });

  group('login screen', () {
    testWidgets('is English and left-to-right by default', (tester) async {
      _tall(tester);
      await tester.pumpWidget(_app(
        prefs: await _prefs(),
        auth: _FakeAuth(),
        profiles: _FakeProfiles(null),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Welcome back. Sign in to continue.'), findsOneWidget);
      expect(_direction(tester, find.text('Login')), TextDirection.ltr);
      expect(find.text('English'), findsOneWidget);
      expect(find.text('العربية'), findsOneWidget);
    });

    testWidgets('opens in Arabic and right-to-left when Arabic was chosen',
        (tester) async {
      _tall(tester);
      await tester.pumpWidget(_app(
        prefs: await _prefs({'language': 'ar'}),
        auth: _FakeAuth(),
        profiles: _FakeProfiles(null),
      ));
      await tester.pumpAndSettle();

      expect(find.text('مرحبًا بعودتك. سجّل الدخول للمتابعة.'), findsOneWidget);
      expect(find.text('البريد الإلكتروني'), findsWidgets);
      expect(_direction(tester, find.text('كلمة المرور').first),
          TextDirection.rtl);
    });

    testWidgets('the selector switches the whole screen at once and remembers it',
        (tester) async {
      _tall(tester);
      final prefs = await _prefs();
      await tester.pumpWidget(_app(
        prefs: prefs,
        auth: _FakeAuth(),
        profiles: _FakeProfiles(null),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('العربية'));
      await tester.pumpAndSettle();
      expect(find.text('تسجيل الدخول'), findsOneWidget);
      expect(find.text('Login'), findsNothing);
      expect(_direction(tester, find.text('تسجيل الدخول')), TextDirection.rtl);
      expect(prefs.getString('language'), 'ar');

      await tester.tap(find.text('English'));
      await tester.pumpAndSettle();
      expect(find.text('Login'), findsOneWidget);
      expect(_direction(tester, find.text('Login')), TextDirection.ltr);
      expect(prefs.getString('language'), 'en');
    });

    testWidgets('validation messages follow the language', (tester) async {
      _tall(tester);
      await tester.pumpWidget(_app(
        prefs: await _prefs({'language': 'ar'}),
        auth: _FakeAuth(),
        profiles: _FakeProfiles(null),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(ElevatedButton, 'تسجيل الدخول'));
      await tester.pumpAndSettle();
      expect(find.text('البريد الإلكتروني مطلوب.'), findsOneWidget);
      expect(find.text('كلمة المرور مطلوبة.'), findsOneWidget);

      await tester.tap(find.text('English'));
      await tester.pumpAndSettle();
      expect(find.text('Email is required.'), findsOneWidget);
      expect(find.text('Password is required.'), findsOneWidget);
    });

    testWidgets('an authentication error is re-translated when the language changes',
        (tester) async {
      _tall(tester);
      await tester.pumpWidget(_app(
        prefs: await _prefs(),
        auth: _FakeAuth(
          signInError: const AuthException(
            'Invalid email or password.',
            code: 'invalid-credential',
          ),
        ),
        profiles: _FakeProfiles(null),
      ));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).at(0), 'a@b.co');
      await tester.enterText(find.byType(TextFormField).at(1), 'secret1');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Login'));
      await tester.pumpAndSettle();
      expect(find.text('Invalid email or password.'), findsOneWidget);

      await tester.tap(find.text('العربية'));
      await tester.pumpAndSettle();
      expect(find.text('البريد الإلكتروني أو كلمة المرور غير صحيحة.'),
          findsOneWidget);
      expect(find.text('Invalid email or password.'), findsNothing);
    });

    testWidgets('the registration screen follows the chosen language too',
        (tester) async {
      _tall(tester);
      await tester.pumpWidget(_app(
        prefs: await _prefs({'language': 'ar'}),
        auth: _FakeAuth(),
        profiles: _FakeProfiles(null),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(TextButton, 'إنشاء حساب'));
      await tester.pumpAndSettle();
      expect(find.text('انضم إلى سوق السودان لتقنية المعلومات'), findsOneWidget);
      expect(find.text('الاسم الكامل'), findsOneWidget);
      expect(_direction(tester, find.text('الاسم الكامل')), TextDirection.rtl);

      await tester.tap(find.text('English'));
      await tester.pumpAndSettle();
      expect(find.text('Join Sudan ICT Marketplace'), findsOneWidget);
      expect(_direction(tester, find.text('Full Name')), TextDirection.ltr);
    });
  });

  group('signed-in language sync', () {
    testWidgets('a language stored on the profile wins over the device',
        (tester) async {
      final prefs = await _prefs({'language': 'en'});
      final profiles = _FakeProfiles(_profile(language: 'ar'));
      await tester.pumpWidget(_app(
        prefs: prefs,
        auth: _FakeAuth(user: _authUser),
        profiles: profiles,
      ));
      await tester.pumpAndSettle();

      expect(find.text('الرئيسية'), findsWidgets);
      expect(_container(tester).read(localeControllerProvider),
          AppLocale.arabic);
      expect(prefs.getString('language'), 'ar');
      expect(profiles.saved, isEmpty, reason: 'nothing to write back');
    });

    testWidgets(
        'an existing user without a stored language keeps the device choice and it is saved to the profile',
        (tester) async {
      final prefs = await _prefs({'language': 'ar'});
      final profiles = _FakeProfiles(_profile());
      await tester.pumpWidget(_app(
        prefs: prefs,
        auth: _FakeAuth(user: _authUser),
        profiles: profiles,
      ));
      await tester.pumpAndSettle();

      expect(find.text('الرئيسية'), findsWidgets);
      expect(profiles.saved, ['ar']);
      expect(profiles.profile?.language, 'ar');
    });

    testWidgets('a user who never chose a language stays in English and nothing is written',
        (tester) async {
      final profiles = _FakeProfiles(_profile());
      await tester.pumpWidget(_app(
        prefs: await _prefs(),
        auth: _FakeAuth(user: _authUser),
        profiles: profiles,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Home'), findsWidgets);
      expect(profiles.saved, isEmpty);
    });

    testWidgets('Settings changes the language now, on the device and on the profile',
        (tester) async {
      final prefs = await _prefs();
      final profiles = _FakeProfiles(_profile());
      await tester.pumpWidget(_app(
        prefs: prefs,
        auth: _FakeAuth(user: _authUser),
        profiles: profiles,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Settings'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(_direction(tester, find.text('Language')), TextDirection.ltr);

      await tester.tap(find.text('العربية'));
      await tester.pumpAndSettle();
      expect(find.text('الإعدادات'), findsWidgets);
      expect(find.text('اللغة'), findsOneWidget);
      expect(_direction(tester, find.text('اللغة')), TextDirection.rtl);
      expect(prefs.getString('language'), 'ar');
      expect(profiles.saved, ['ar']);

      await tester.tap(find.text('English'));
      await tester.pumpAndSettle();
      expect(find.text('Settings'), findsWidgets);
      expect(_direction(tester, find.text('Language')), TextDirection.ltr);
      expect(prefs.getString('language'), 'en');
      expect(profiles.saved, ['ar', 'en']);
    });

    testWidgets('the signed-in area flips to RTL and back without signing out',
        (tester) async {
      await tester.pumpWidget(_app(
        prefs: await _prefs(),
        auth: _FakeAuth(user: _authUser),
        profiles: _FakeProfiles(_profile()),
      ));
      await tester.pumpAndSettle();
      expect(_direction(tester, find.text('Home').first), TextDirection.ltr);

      await tester.tap(find.byTooltip('Settings'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('العربية'));
      await tester.pumpAndSettle();
      Navigator.of(tester.element(find.byType(SettingsScreen))).pop();
      await tester.pumpAndSettle();

      expect(find.text('الرئيسية'), findsWidgets);
      expect(_direction(tester, find.text('الرئيسية').first),
          TextDirection.rtl);
      // Still the same signed-in session.
      expect(find.text('Login'), findsNothing);
      expect(find.text('تسجيل الدخول'), findsNothing);
    });

    testWidgets('a failed profile save keeps the new language and is retried at the next sign-in',
        (tester) async {
      final prefs = await _prefs();
      final profiles = _FakeProfiles(_profile(language: 'en'))
        ..failSaving = true;
      await tester.pumpWidget(_app(
        prefs: prefs,
        auth: _FakeAuth(user: _authUser),
        profiles: profiles,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Settings'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('العربية'));
      // Not settled: the message disappears by itself after a few seconds.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      // Language changed here, and the user is told it was not saved yet.
      expect(find.text('الإعدادات'), findsWidgets);
      expect(prefs.getString('language'), 'ar');
      expect(
        find.text('تم تغيير اللغة على هذا الجهاز، لكن تعذر حفظها في حسابك حاليًا.'),
        findsOneWidget,
      );
      expect(prefs.getBool(languagePendingSyncKey), isTrue);
      expect(profiles.saved, isEmpty);

      // Next sign-in: the older stored 'en' must not overwrite the newer choice.
      profiles.failSaving = false;
      final container = _container(tester);
      await container.read(languageServiceProvider).reconcile(
            _profile(language: 'en'),
          );
      expect(profiles.saved, ['ar']);
      expect(prefs.getBool(languagePendingSyncKey), isNull);
    });

    testWidgets('after signing out the login screen keeps the language of the device',
        (tester) async {
      final prefs = await _prefs();
      await tester.pumpWidget(_app(
        prefs: prefs,
        auth: _FakeAuth(user: _authUser),
        profiles: _FakeProfiles(_profile(language: 'ar')),
      ));
      await tester.pumpAndSettle();
      expect(find.text('الرئيسية'), findsWidgets);

      await _container(tester).read(authControllerProvider.notifier).signOut();
      await tester.pumpAndSettle();

      expect(find.text('مرحبًا بعودتك. سجّل الدخول للمتابعة.'), findsOneWidget);
      expect(prefs.getString('language'), 'ar');
    });
  });

  group('texts that come from the data layer', () {
    test('order statuses are translated', () {
      final en = lookupAppLocalizations(AppLocale.english);
      final ar = lookupAppLocalizations(AppLocale.arabic);
      expect(OrderStatus.processing.label(en), 'Processing');
      expect(OrderStatus.processing.label(ar), 'قيد المعالجة');
      expect(OrderStatus.outForDelivery.label(ar), 'في الطريق للتسليم');
      expect(OrderStatus.completed.label(ar), 'مكتمل');
      expect(PaymentStatus.pendingVerification.label(ar), 'بانتظار التحقق');
      expect(PaymentStatus.confirmed.label(ar), 'مؤكد');
      expect(DeliveryMethod.pickup.label(ar), 'استلام');
      expect(DeliveryMethod.delivery.label(ar), 'توصيل');
      expect(OrderStatus.processing.jobLabel(ar), 'قيد الانتظار');
      expect(OrderStatus.outForDelivery.jobLabel(ar), 'قيد التنفيذ');
    });

    AppNotification notification(String type, String title, String body) =>
        AppNotification(
          id: 'n1',
          recipientType: NotificationRecipientType.customer,
          recipientId: 'u1',
          orderId: 'o1',
          type: type,
          title: title,
          body: body,
          createdAt: DateTime(2026),
        );

    test('a stored English notification is shown in the reader\'s language', () {
      final ar = lookupAppLocalizations(AppLocale.arabic);
      final en = lookupAppLocalizations(AppLocale.english);
      final n = notification(
        'payment_confirmed',
        'Payment confirmed',
        'Your payment for "Dell Laptop" has been confirmed.',
      );
      expect(NotificationFormat.title(ar, n), 'تم تأكيد الدفع');
      expect(NotificationFormat.body(ar, n), contains('Dell Laptop'));
      expect(NotificationFormat.body(ar, n), isNot(contains('Your payment')));
      expect(NotificationFormat.body(en, n), n.body);
    });

    test('the product name is kept exactly as stored, quotes included', () {
      final ar = lookupAppLocalizations(AppLocale.arabic);
      final n = notification(
        'new_order',
        'New order received',
        'A new order for "15" Monitor" was placed and is awaiting payment verification.',
      );
      expect(NotificationFormat.body(ar, n), contains('15" Monitor'));
    });

    test('the completed-order message and unknown types are handled', () {
      final ar = lookupAppLocalizations(AppLocale.arabic);
      final done = notification('order_completed', 'Order completed', 'تم إكمال طلبك');
      expect(NotificationFormat.body(ar, done), 'تم إكمال طلبك');
      final unknown = notification('something_new', 'Custom title', 'Custom body');
      expect(NotificationFormat.title(ar, unknown), 'Custom title');
      expect(NotificationFormat.body(ar, unknown), 'Custom body');
    });
  });
}
