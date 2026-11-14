import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';
import 'package:sudan_it_marketplace/features/products/data/models/product_model.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/widgets/product_gallery.dart';

// ignore: subtype_of_sealed_class
class _FakeSnapshot extends Fake implements DocumentSnapshot<Map<String, dynamic>> {
  _FakeSnapshot(this._data);

  final Map<String, dynamic> _data;

  @override
  String get id => 'doc1';

  @override
  Map<String, dynamic>? data() => _data;
}

Product _read(Map<String, dynamic> extra) =>
    ProductModel.fromFirestore(_FakeSnapshot({'name': 'Router', ...extra}));

void main() {
  group('the pictures of a product', () {
    test('an older product with one picture has a gallery of one', () {
      expect(_read({'imageUrl': 'https://a.test/1.jpg'}).imageUrls, ['https://a.test/1.jpg']);
    });

    test('a product with none has an empty gallery', () {
      expect(_read({'imageUrl': ''}).imageUrls, isEmpty);
      expect(_read({}).imageUrls, isEmpty);
    });

    test('the company panel\'s list is read in order, blanks dropped, at most 5', () {
      final urls = ['https://a.test/1.jpg', ' ', 'https://a.test/2.jpg', 'https://a.test/3.jpg', 'https://a.test/4.jpg', 'https://a.test/5.jpg', 'https://a.test/6.jpg'];
      final product = _read({'imageUrl': 'https://a.test/1.jpg', 'imageUrls': urls});
      expect(product.imageUrls.length, 5);
      expect(product.imageUrls.first, 'https://a.test/1.jpg');
      expect(product.imageUrls, isNot(contains(' ')));
    });
  });

  group('the gallery on the product page', () {
    Widget app(List<String> urls) => MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(body: SingleChildScrollView(child: ProductGallery(urls: urls))),
        );

    testWidgets('one picture is not swipeable and has no dots', (tester) async {
      await tester.pumpWidget(app(const ['https://a.test/1.jpg']));
      expect(find.byKey(const ValueKey('product-gallery')), findsNothing);
      expect(find.byType(AnimatedContainer), findsNothing);
    });

    testWidgets('several pictures can be swiped, with a dot for each', (tester) async {
      await tester.pumpWidget(app(const ['https://a.test/1.jpg', 'https://a.test/2.jpg', 'https://a.test/3.jpg']));
      expect(find.byKey(const ValueKey('product-gallery')), findsOneWidget);
      expect(find.byType(AnimatedContainer), findsNWidgets(3));
      await tester.drag(find.byKey(const ValueKey('product-gallery')), const Offset(-400, 0));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
