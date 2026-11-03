import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/products/data/models/product_model.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/domain/product_visibility.dart';

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
    ProductModel.fromFirestore(_FakeSnapshot({'name': 'Router', 'price': 100, ...extra}));

void main() {
  group('a product its company took off sale', () {
    test('a document with no status is published', () {
      final product = _read({});
      expect(product.status, 'published');
      expect(product.isPublished, isTrue);
    });

    test('a draft and an archived product are read as such', () {
      expect(_read({'status': 'draft'}).isPublished, isFalse);
      expect(_read({'status': 'archived'}).isPublished, isFalse);
    });

    test('an unknown status reads as published, never as a way around the rules', () {
      expect(_read({'status': 'whatever'}).status, 'published');
    });

    test('is kept from customers, and so is one Platform Admin hid', () {
      final shown = withoutHiddenProducts([
        _read({}),
        _read({'status': 'draft'}),
        _read({'status': 'archived'}),
        _read({'hidden': true}),
      ]);
      expect(shown, hasLength(1));
    });

    test('is never written back by the app, so a company\'s edit leaves it alone', () {
      final fields = ProductModel.toFirestoreFields(_read({'status': 'draft'}));
      expect(fields.containsKey('status'), isFalse);
    });

    test('keeps its status through the copies the app makes', () {
      final draft = _read({'status': 'draft'});
      expect(draft.withStockCount(3).status, 'draft');
      expect(draft.withOffer(50, null).status, 'draft');
    });
  });
}
