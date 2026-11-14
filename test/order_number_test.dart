import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/core/utils/search_ranking.dart';
import 'package:sudan_it_marketplace/core/utils/short_id.dart';
import 'package:sudan_it_marketplace/features/orders/domain/entities/order_entity.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_details_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/order_pending_verification_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/widgets/order_card.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

// A real-looking id: base-36 microseconds, 10 characters.
const _fullId = 'hmm509xguh';
const _number = '#hmm509xg';

OrderEntity _order(String id) => OrderEntity(
      id: id,
      customerId: 'u1',
      companyId: 'c1',
      companyName: 'Khartoum Tech',
      productId: 'p1',
      productName: 'Router',
      quantity: 1,
      unitPrice: 100,
      productSubtotal: 100,
      installationSelected: false,
      installationFee: 0,
      deliveryFee: 0,
      totalAmount: 100,
      deliveryAddress: 'Street 1',
      contactPhone: '0911111111',
      createdAt: DateTime(2026),
    );

Widget _app(Widget home, {Locale locale = const Locale('en')}) => ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light,
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

void main() {
  group('the short order number', () {
    test('is the first 8 characters, and never changes a shorter id', () {
      expect(shortReference(_fullId), 'hmm509xg');
      expect(shortReference('abc'), 'abc');
      expect(shortReference('12345678'), '12345678');
      expect(shortReference(''), '');
      expect(shortReference('aBcDeFgHiJkLmNoPqRsT'), 'aBcDeFgH'); // auto-ids
    });

    test('an order shortId uses the shared rule', () {
      expect(_order(_fullId).shortId, shortReference(_fullId));
    });
  });

  group('every customer screen shows the same number', () {
    testWidgets('list card, details and confirmation all read $_number',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final order = _order(_fullId);

      await tester.pumpWidget(_app(Scaffold(body: OrderCard(order: order))));
      expect(find.text('Order $_number'), findsOneWidget);

      await tester.pumpWidget(_app(OrderDetailsScreen(order: order)));
      expect(find.text('Order $_number'), findsOneWidget);

      await tester.pumpWidget(_app(OrderPendingVerificationScreen(order: order)));
      expect(find.text(_number), findsOneWidget);
      // the confirmation no longer shows the longer, different reference
      expect(find.text('#$_fullId'), findsNothing);
    });

    testWidgets('Arabic keeps the # attached to the code', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        _app(OrderDetailsScreen(order: _order(_fullId)), locale: const Locale('ar')),
      );
      expect(find.text('طلب ‎$_number'), findsOneWidget);
    });
  });

  group('company order search', () {
    final orders = [_order(_fullId), _order('zzz111aaab')];
    List<String> find_(String query) => [
          for (final o in searchRanked(orders, query, (o) => [SearchField(o.id, weight: 2)]))
            o.id,
        ];

    test('finds an order by the short number people read out', () {
      expect(find_('hmm509xg'), [_fullId]);
      expect(find_('#hmm509xg'), [_fullId]);
    });

    test('finds it by the full reference too, as a strong prefix match', () {
      expect(find_(_fullId), [_fullId]);
      expect(find_('#$_fullId'), [_fullId]);
      expect(find_('HMM509'), [_fullId]); // case-insensitive, partial
    });

    test('does not match another order', () {
      expect(find_('zzz111'), ['zzz111aaab']);
      expect(find_('nomatch99'), isEmpty);
    });
  });
}
