import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/stock_reservation.dart';
import 'package:sudan_it_marketplace/features/products/presentation/product_details_screen.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';

Product _product(String id, int stock, {bool inStock = true}) => Product(
      id: id,
      name: 'Dell Laptop $id',
      price: 1000,
      stockCount: stock,
      inStock: inStock,
    );

/// Sells [quantities] one after another, the way successive orders would.
int _remainingAfter(int stock, List<int> quantities) {
  var left = stock;
  for (final quantity in quantities) {
    left = StockReservation.remainingAfter(
      available: left,
      requested: quantity,
      productName: 'Dell Laptop',
    );
  }
  return left;
}

Widget _detailsScreen(Product product, Stream<List<Product>> catalogue) {
  return ProviderScope(
    overrides: [
      firestoreProductsStreamProvider.overrideWith((ref) => catalogue),
      resolvedCompanyProvider.overrideWith((ref, companyId) => null),
    ],
    child: MaterialApp(home: ProductDetailsScreen(product: product)),
  );
}

ElevatedButton _buyButton(WidgetTester tester) =>
    tester.widget<ElevatedButton>(find.byType(ElevatedButton));

void main() {
  group('marketplace visibility', () {
    test('stockCount 10 is visible to customers', () {
      expect(productsWithStock([_product('a', 10)]).map((p) => p.id), ['a']);
    });

    test('stockCount 0 is hidden from customers', () {
      expect(productsWithStock([_product('a', 0)]), isEmpty);
    });

    test('only the products with units left stay in a mixed list', () {
      final visible = productsWithStock([
        _product('a', 10),
        _product('b', 0),
        _product('c', 1),
      ]);
      expect(visible.map((p) => p.id), ['a', 'c']);
    });

    test('a product missing its stock field reads as 0 and stays hidden', () {
      // ProductModel maps a missing stockCount to 0 (see product_model.dart).
      expect(productsWithStock([_product('legacy', 0)]), isEmpty);
    });

    test('restocking 0 -> 20 makes the product visible again', () {
      final soldOut = _product('a', 0);
      expect(productsWithStock([soldOut]), isEmpty);
      final restocked = soldOut.withStockCount(20);
      expect(productsWithStock([restocked]).map((p) => p.id), ['a']);
      expect(restocked.isAvailable, isTrue);
    });

    test('selling the last units hides the product but keeps it a real product',
        () {
      final left = _remainingAfter(10, [2, 3, 5]);
      expect(left, 0);
      final product = _product('a', 10).withStockCount(left);
      expect(product.hasStock, isFalse);
      expect(product.isAvailable, isFalse);
      expect(productsWithStock([product]), isEmpty);
    });
  });

  group('stock is consumed by order quantity', () {
    test('stock 10 and an order of quantity 2 leaves 8', () {
      expect(_remainingAfter(10, [2]), 8);
    });

    test('stock 10 and orders of quantity 2 and 3 leaves 5, not 8', () {
      expect(_remainingAfter(10, [2, 3]), 5);
    });

    test('orders of 2, 3 and 5 use the whole stock of 10', () {
      expect(_remainingAfter(10, [2, 3, 5]), 0);
    });
  });

  group('overselling is rejected', () {
    test('stock 2 and a request for 3 is rejected', () {
      expect(
        () => StockReservation.remainingAfter(
          available: 2,
          requested: 3,
          productName: 'Dell Laptop',
        ),
        throwsA(
          isA<StockUnavailableException>()
              .having((e) => e.available, 'available', 2)
              .having((e) => e.requested, 'requested', 3)
              .having((e) => e.message, 'message', contains('Only 2')),
        ),
      );
    });

    test('stock 2 and a request for 2 succeeds and leaves 0', () {
      expect(
        StockReservation.remainingAfter(
          available: 2,
          requested: 2,
          productName: 'Dell Laptop',
        ),
        0,
      );
    });

    test('an out-of-stock product cannot be ordered at all', () {
      expect(
        () => StockReservation.remainingAfter(
          available: 0,
          requested: 1,
          productName: 'Dell Laptop',
        ),
        throwsA(isA<StockUnavailableException>()),
      );
    });

    test('a non-positive quantity is rejected', () {
      expect(
        () => StockReservation.remainingAfter(
          available: 5,
          requested: 0,
          productName: 'Dell Laptop',
        ),
        throwsA(isA<StockUnavailableException>()),
      );
    });

    test('stock never goes negative for any stock and quantity', () {
      for (var stock = 0; stock <= 6; stock++) {
        for (var quantity = -1; quantity <= 8; quantity++) {
          try {
            final left = StockReservation.remainingAfter(
              available: stock,
              requested: quantity,
              productName: 'Dell Laptop',
            );
            expect(left, greaterThanOrEqualTo(0));
            expect(left, stock - quantity);
          } on StockUnavailableException {
            // Rejected: the stored stock is untouched, so it cannot go negative.
          }
        }
      }
    });
  });

  group('quantity limits', () {
    test('a customer can order at most the units in stock', () {
      expect(_product('a', 4).maxOrderQuantity, 4);
    });

    test('nothing can be ordered from an out-of-stock or unavailable product',
        () {
      expect(_product('a', 0).maxOrderQuantity, 0);
      expect(_product('a', 4, inStock: false).maxOrderQuantity, 0);
    });
  });

  group('product screen', () {
    testWidgets('the quantity selector stops at the available stock (4)',
        (tester) async {
      final product = _product('real1', 4);
      await tester.pumpWidget(
        _detailsScreen(product, Stream.value([product])),
      );
      await tester.pump();

      for (var i = 0; i < 10; i++) {
        await tester.tap(find.byIcon(Icons.add));
        await tester.pump();
      }

      expect(find.text('4'), findsOneWidget);
      expect(find.text('5'), findsNothing);
      expect(_buyButton(tester).onPressed, isNotNull);
    });

    testWidgets('a stale screen for a product that sold out cannot buy',
        (tester) async {
      // Opened from an old card that still said 4 in stock, but the live
      // catalogue no longer lists it.
      final stale = _product('real1', 4);
      await tester.pumpWidget(_detailsScreen(stale, Stream.value(const [])));
      await tester.pump();

      expect(find.text('Out of Stock'), findsOneWidget);
      expect(_buyButton(tester).onPressed, isNull);
    });

    testWidgets('stock dropping while the screen is open lowers the quantity',
        (tester) async {
      final opened = _product('real1', 5);
      final catalogue = StreamController<List<Product>>();
      addTearDown(catalogue.close);

      await tester.pumpWidget(_detailsScreen(opened, catalogue.stream));
      catalogue.add([opened]);
      await tester.pump();

      for (var i = 0; i < 4; i++) {
        await tester.tap(find.byIcon(Icons.add));
        await tester.pump();
      }
      expect(find.text('5'), findsOneWidget);

      catalogue.add([opened.withStockCount(2)]);
      await tester.pump();

      expect(find.text('5'), findsNothing);
      expect(find.text('2'), findsWidgets);
      expect(_buyButton(tester).onPressed, isNotNull);

      // And it can no longer be pushed past the new limit.
      await tester.tap(find.byIcon(Icons.add));
      await tester.pump();
      expect(find.text('3'), findsNothing);
    });

    testWidgets('restocking from 0 lets the same screen buy again',
        (tester) async {
      final soldOut = _product('real1', 0);
      final catalogue = StreamController<List<Product>>();
      addTearDown(catalogue.close);

      await tester.pumpWidget(_detailsScreen(soldOut, catalogue.stream));
      catalogue.add(const []);
      await tester.pump();
      expect(_buyButton(tester).onPressed, isNull);

      catalogue.add([soldOut.withStockCount(20)]);
      await tester.pump();
      await tester.pump();
      expect(find.text('In Stock (20)'), findsOneWidget);
      expect(_buyButton(tester).onPressed, isNotNull);
    });
  });

  group('resolveLiveProduct', () {
    test('keeps the snapshot while the catalogue is still loading', () {
      final snapshot = _product('real1', 4);
      expect(
        resolveLiveProduct(snapshot, const AsyncLoading()).stockCount,
        4,
      );
    });

    test('takes the latest stock from the catalogue', () {
      final live = resolveLiveProduct(
        _product('real1', 4),
        AsyncData([_product('real1', 1)]),
      );
      expect(live.stockCount, 1);
    });

    test('treats a real product missing from the catalogue as out of stock',
        () {
      final live = resolveLiveProduct(
        _product('real1', 4),
        const AsyncData(<Product>[]),
      );
      expect(live.stockCount, 0);
      expect(live.isAvailable, isFalse);
    });

    test('never touches the built-in demo products', () {
      final demo = _product('p1', 8);
      expect(
        resolveLiveProduct(demo, const AsyncData(<Product>[])).stockCount,
        8,
      );
    });
  });
}
