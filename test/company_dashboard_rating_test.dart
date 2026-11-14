import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/dashboard/company_dashboard_tab.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/reviews/company_reviews_screen.dart';
import 'package:sudan_it_marketplace/features/orders/presentation/orders_providers.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/review.dart';
import 'package:sudan_it_marketplace/features/reviews/presentation/reviews_providers.dart';

Widget _home(Map<String, RatingStats> ratings) => ProviderScope(
      overrides: [
        companyProductsStreamProvider
            .overrideWith((ref, id) => Stream.value(const [])),
        companyOrdersStreamProvider
            .overrideWith((ref, id) => Stream.value(const [])),
        ratingsProvider.overrideWith((ref) => Stream.value(ratings)),
        companyReviewsProvider
            .overrideWith((ref, id) => Stream.value(const <Review>[])),
      ],
      child: const MaterialApp(
        home: Scaffold(body: CompanyDashboardTab(companyId: 'c1')),
      ),
    );

/// A phone screen (360 x 800), where the figures sit two to a row.
void _phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

void main() {
  // The company's rating sits on Home with the other figures, like the
  // merchant apps of Uber Eats or DoorDash, instead of only under Account.
  testWidgets("Home shows the company's rating and opens the ratings",
      (tester) async {
    _phone(tester);
    await tester.pumpWidget(_home({
      RatingStats.companyKey('c1'): const RatingStats(sum: 9, count: 2),
      RatingStats.companyKey('other'): const RatingStats(sum: 1, count: 1),
    }));
    await tester.pumpAndSettle();

    final tile = find.byKey(const ValueKey('dashboard-rating'));
    expect(
      find.descendant(of: tile, matching: find.text('4.5')),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: tile,
        matching: find.text('Customer ratings (2 reviews)'),
      ),
      findsOneWidget,
    );

    await tester.tap(tile);
    await tester.pumpAndSettle();
    expect(find.byType(CompanyReviewsScreen), findsOneWidget);
  });

  testWidgets('a company nobody has rated yet shows a dash, not 0.0',
      (tester) async {
    _phone(tester);
    await tester.pumpWidget(_home(const {}));
    await tester.pumpAndSettle();

    final tile = find.byKey(const ValueKey('dashboard-rating'));
    expect(find.descendant(of: tile, matching: find.text('—')), findsOneWidget);
    expect(
      find.descendant(of: tile, matching: find.text('Customer ratings')),
      findsOneWidget,
    );
  });
}
