import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/product.dart';
import '../models/product_model.dart';
import 'products_remote_data_source.dart';

class FirestoreProductsRemoteDataSource implements ProductsRemoteDataSource {
  FirestoreProductsRemoteDataSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  static const _productsCollection = 'products';
  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _products =>
      _firestore.collection(_productsCollection);

  List<Product> _sorted(QuerySnapshot<Map<String, dynamic>> snapshot) {
    final list = snapshot.docs.map(ProductModel.fromFirestore).toList();
    list.sort((a, b) {
      final aDate = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bDate = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bDate.compareTo(aDate);
    });
    return list;
  }

  /// Products a customer can see: only those with units left. A product at
  /// `stockCount == 0` (or with no stock field) is left out here but stays in
  /// Firestore and in the company's own list, and reappears the moment the
  /// company restocks it. A single-field range filter needs no composite index.
  @override
  Stream<List<Product>> watchMarketplaceProducts() {
    return _products
        .where('stockCount', isGreaterThan: 0)
        .snapshots()
        .map(_sorted);
  }

  @override
  Stream<List<Product>> watchCompanyProducts(String companyId) {
    return _products
        .where('companyId', isEqualTo: companyId)
        .snapshots()
        .map(_sorted);
  }

  @override
  String newProductId() => _products.doc().id;

  @override
  Future<void> createProduct(Product product) async {
    try {
      await _products.doc(product.id).set({
        ...ProductModel.toFirestoreFields(product),
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw Exception(_message(error, 'save'));
    }
  }

  @override
  Future<void> updateProduct(Product product) async {
    try {
      final fields = ProductModel.toFirestoreFields(product)
        ..remove('id')
        ..remove('companyId');
      await _products.doc(product.id).update({
        ...fields,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw Exception(_message(error, 'update'));
    }
  }

  @override
  Future<void> deleteProduct(String productId) async {
    try {
      await _products.doc(productId).delete();
    } on FirebaseException catch (error) {
      throw Exception(_message(error, 'delete'));
    }
  }

  String _message(FirebaseException error, String action) {
    if (error.code == 'permission-denied') {
      return 'You do not have permission to $action this product.';
    }
    return 'Could not $action the product: ${error.message ?? error.code}';
  }
}
