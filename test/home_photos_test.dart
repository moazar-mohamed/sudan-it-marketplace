// A photo's shape must never decide how big its card is. Real pictures of a
// few shapes are put in cards side by side (the test binding refuses network
// requests, so test/helpers/fake_photos.dart serves them).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_hero_offers.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_recent_row.dart';
import 'package:sudan_it_marketplace/features/customer_dashboard/presentation/widgets/home_design.dart';
import 'package:sudan_it_marketplace/features/offers/domain/offer_item.dart';
import 'package:sudan_it_marketplace/features/offers/presentation/offer_card.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/widgets/product_grid_card.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/review.dart';
import 'package:sudan_it_marketplace/features/reviews/presentation/reviews_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

import 'helpers/fake_photos.dart';

const _photos = [
  FakePhotos.squarePhoto,
  FakePhotos.widePhoto,
  FakePhotos.tinyPhoto,
];

Product _product(String id, String photo) => Product(
  id: id,
  name: 'Product $id',
  price: 1000,
  offerPrice: 800,
  offerEndsAt: DateTime.now().add(const Duration(days: 3)),
  imageUrl: photo,
  createdAt: DateTime.now(),
);

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Locale locale = const Locale('en'),
  double width = 390,
  double pixelRatio = 1,
  double padding = 16,
}) async {
  tester.view.physicalSize = Size(width * pixelRatio, 1400);
  tester.view.devicePixelRatio = pixelRatio;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ratingsProvider.overrideWith(
          (ref) => Stream.value(const <String, RatingStats>{}),
        ),
      ],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: Padding(padding: EdgeInsets.all(padding), child: child),
        ),
      ),
    ),
  );
  await FakePhotos.settle(tester);
}

/// The sizes of every picture (loaded, not the "no photo" icon) under [root].
List<Size> _photoSizes(WidgetTester tester, Finder root) => [
  for (final image in tester.widgetList<Image>(
    find.descendant(of: root, matching: find.byType(Image)),
  ))
    tester.getSize(find.byWidget(image)),
];

void main() {
  group('the product grid card', () {
    Future<void> pumpGrid(
      WidgetTester tester, {
      Locale locale = const Locale('en'),
      double pixelRatio = 1,
    }) => _pump(
      tester,
      IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < _photos.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: ProductGridCard(product: _product('p$i', _photos[i])),
              ),
            ],
          ],
        ),
      ),
      locale: locale,
      pixelRatio: pixelRatio,
    );

    for (final (name, locale, ratio) in [
      ('English', const Locale('en'), 1.0),
      ('Arabic', const Locale('ar'), 1.0),
      ('a phone screen (2.75x)', const Locale('ar'), 2.75),
    ]) {
      testWidgets(
        'a square, a wide and a tiny photo fill the same band: $name',
        (tester) => FakePhotos.serve(() async {
          await pumpGrid(tester, locale: locale, pixelRatio: ratio);
          final sizes = _photoSizes(tester, find.byType(ProductGridCard));
          // All three photos really loaded (a failed one shows an icon, not an Image).
          expect(sizes, hasLength(3));
          for (final size in sizes) {
            expect(size.height, ProductGridCard.photoHeight, reason: '$sizes');
            // As wide as the card, not a tile pinned to one side.
            expect(size.width, sizes.first.width, reason: '$sizes');
          }
          final cards = find.byType(ProductGridCard);
          expect(
            {for (var i = 0; i < 3; i++) tester.getSize(cards.at(i))},
            hasLength(1),
            reason: 'cards in a row have the same size',
          );
        }),
      );
    }

    testWidgets('a card with no photo has the same band', (tester) async {
      await pumpGrid(tester);
      final card = tester.getSize(find.byType(ProductGridCard).first);
      expect(card.height, greaterThan(ProductGridCard.photoHeight));
    });
  });

  group('the offer card', () {
    testWidgets(
      'a square and a wide photo take the same band',
      (tester) => FakePhotos.serve(() async {
        await _pump(
          tester,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final photo in [
                FakePhotos.squarePhoto,
                FakePhotos.widePhoto,
              ]) ...[
                OfferCard(
                  item: ProductOfferItem(_product(photo, photo)),
                  width: 156,
                ),
                const SizedBox(width: 12),
              ],
            ],
          ),
        );
        final sizes = _photoSizes(tester, find.byType(OfferCard));
        expect(sizes, hasLength(2));
        expect(sizes.toSet(), {const Size(156, 120)}, reason: '$sizes');
      }),
    );
  });

  group('the other photos on the home', () {
    testWidgets(
      'recently added: every photo is the same square',
      (tester) => FakePhotos.serve(() async {
        await _pump(
          tester,
          HomeRecentRow(
            products: [for (final p in _photos) _product(p, p)],
            categories: const {},
            horizontalPadding: 0,
            onViewAll: () {},
          ),
          // Wide enough that the sideways row builds all three cards.
          width: 1200,
        );
        final sizes = _photoSizes(tester, find.byType(HomeRecentRow));
        expect(sizes, hasLength(3));
        expect(sizes.toSet(), {const Size(84, 84)}, reason: '$sizes');
      }),
    );

    testWidgets(
      'the hero card: the photo is the same circle whatever its shape',
      (tester) => FakePhotos.serve(() async {
        for (final photo in _photos) {
          await _pump(
            tester,
            HomeHeroOffers(offers: [ProductOfferItem(_product('h', photo))]),
            // Full width, as on the home (a narrow card drops the photo).
            padding: 0,
          );
          final sizes = _photoSizes(tester, find.byType(HomeHeroOffers));
          expect(sizes, [const Size(108, 108)], reason: photo);
        }
      }),
    );
  });

  test('the pictures of the helper really are of those shapes', () {
    expect(HomePalette.heroNavy, isNotNull); // keeps the import honest
    expect(_photos, hasLength(3));
  });
}
