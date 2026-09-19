import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../companies/domain/entities/company.dart';
import '../../companies/presentation/companies_providers.dart';
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

/// Keeps only products a customer may see: those of an active company.
/// A product whose company is deactivated, rejected, pending or deleted is
/// hidden, and reappears as soon as the company is active again. While the
/// company list has not loaded (`companies == null`) company products stay
/// hidden rather than flashing. Products with no company are kept.
List<Product> productsOfActiveCompanies(
  List<Product> products,
  List<Company>? companies,
) {
  final activeIds = companies == null
      ? const <String>{}
      : {
          for (final company in companies)
            if (company.isActive) company.id,
        };
  return products.where((product) {
    final companyId = product.companyId;
    if (companyId == null || companyId.isEmpty) {
      return true;
    }
    return activeIds.contains(companyId);
  }).toList();
}

/// Customer-facing catalogue: products of active companies followed by the
/// existing demo catalogue. Falls back to the demo catalogue if Firestore
/// cannot be read so the customer home never breaks.
final marketplaceProductsProvider = Provider<List<Product>>((ref) {
  final remote = ref.watch(firestoreProductsStreamProvider).asData?.value ??
      const <Product>[];
  final companies = ref.watch(firestoreCompaniesStreamProvider).asData?.value;
  return [...productsOfActiveCompanies(remote, companies), ...mockProducts];
});

final companyProductsStreamProvider =
    StreamProvider.family<List<Product>, String>((ref, companyId) {
  if (companyId.isEmpty) {
    return Stream.value(const []);
  }
  return ref.watch(productsRepositoryProvider).watchCompanyProducts(companyId);
});
