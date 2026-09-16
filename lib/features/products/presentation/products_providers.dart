import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../customer_dashboard/data/mock_marketplace_data.dart';
import '../data/datasources/firestore_products_remote_data_source.dart';
import '../data/datasources/products_remote_data_source.dart';
import '../data/repositories/products_repository_impl.dart';
import '../domain/entities/product.dart';
import '../domain/repositories/products_repository.dart';

final productsRemoteDataSourceProvider =
    Provider<ProductsRemoteDataSource>((ref) {
  return FirestoreProductsRemoteDataSource();
});

final productsRepositoryProvider = Provider<ProductsRepository>((ref) {
  return ProductsRepositoryImpl(ref.watch(productsRemoteDataSourceProvider));
});

/// Products published by companies in Firestore.
final firestoreProductsStreamProvider = StreamProvider<List<Product>>((ref) {
  return ref.watch(productsRepositoryProvider).watchAllProducts();
});

/// Customer-facing catalogue: company-managed Firestore products followed by
/// the existing demo catalogue. Falls back to the demo catalogue if Firestore
/// cannot be read so the customer home never breaks.
final marketplaceProductsProvider = Provider<List<Product>>((ref) {
  final remote = ref.watch(firestoreProductsStreamProvider).asData?.value ??
      const <Product>[];
  return [...remote, ...mockProducts];
});

final companyProductsStreamProvider =
    StreamProvider.family<List<Product>, String>((ref, companyId) {
  if (companyId.isEmpty) {
    return Stream.value(const []);
  }
  return ref.watch(productsRepositoryProvider).watchCompanyProducts(companyId);
});
