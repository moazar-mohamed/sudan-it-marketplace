import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_hero_offers.dart';
import 'package:sudan_it_marketplace/features/offers/domain/offer_item.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

OfferItem _offer(String name) => ProductOfferItem(
  Product(
    id: name,
    name: name,
    price: 1000,
    offerPrice: 800,
    companyId: 'c1',
    companyName: 'Co',
  ),
);

void main() {
  Future<void> pumpHero(
    WidgetTester tester, {
    int count = 3,
    bool disableAnimations = false,
  }) async {
    tester.view.physicalSize = const Size(390, 600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(disableAnimations: disableAnimations),
          child: child!,
        ),
        home: Scaffold(
          body: HomeHeroOffers(
            offers: [for (var i = 0; i < count; i++) _offer('Offer $i')],
          ),
        ),
      ),
    );
  }

  /// The offer the page view is showing (the one with the largest share of
  /// the viewport).
  int shown(WidgetTester tester) {
    final view = tester.widget<PageView>(find.byType(PageView));
    return view.controller!.page!.round();
  }

  testWidgets('the banner moves to the next offer by itself, then wraps', (
    tester,
  ) async {
    await pumpHero(tester);
    expect(shown(tester), 0);

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(shown(tester), 1);

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(shown(tester), 2);

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(shown(tester), 0);
  });

  testWidgets('a finger on the banner holds it still', (tester) async {
    await pumpHero(tester);
    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(PageView)),
    );
    await tester.pump(const Duration(seconds: 12));
    expect(shown(tester), 0);

    await gesture.cancel(); // a lift would tap the card and open it
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    expect(shown(tester), 1);
  });

  testWidgets('one offer, or no animations, keeps it still', (tester) async {
    await pumpHero(tester, count: 1);
    await tester.pump(const Duration(seconds: 6));
    await tester.pumpAndSettle();
    expect(shown(tester), 0);

    await pumpHero(tester, disableAnimations: true);
    await tester.pump(const Duration(seconds: 6));
    await tester.pumpAndSettle();
    expect(shown(tester), 0);
  });
}
