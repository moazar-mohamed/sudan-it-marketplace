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
  return ref.watch(productsRepositoryProvider).watchMarketplaceProducts();
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

/// Drops products with no units left. The marketplace query already filters
/// on the server; this keeps the rule in one testable place and covers any
/// stale or cached snapshot.
List<Product> productsWithStock(List<Product> products) =>
    products.where((product) => product.hasStock).toList();

/// Customer-facing catalogue: in-stock products of active companies followed
/// by the existing demo catalogue. Falls back to the demo catalogue if
/// Firestore cannot be read so the customer home never breaks.
final marketplaceProductsProvider = Provider<List<Product>>((ref) {
  final remote = ref.watch(firestoreProductsStreamProvider).asData?.value ??
      const <Product>[];
  final companies = ref.watch(firestoreCompaniesStreamProvider).asData?.value;
  return [
    ...productsWithStock(productsOfActiveCompanies(remote, companies)),
    ...mockProducts,
  ];
});

/// The product as the marketplace currently stands, for a screen that was
/// opened earlier (a stale card or a direct link).
///
/// Once the catalogue has loaded, a real product that is no longer listed
/// (sold out, or its company went inactive) is treated as out of stock so it
/// cannot be bought from an old screen; a listed product takes its latest
/// stock. Demo products, and any state where the catalogue has not loaded,
/// keep the snapshot. The order transaction still re-checks stock on submit.
Product resolveLiveProduct(
  Product snapshot,
  AsyncValue<List<Product>> catalogue,
) {
  if (mockProducts.any((product) => product.id == snapshot.id)) {
    return snapshot;
  }
  final listed = catalogue.asData?.value;
  if (listed == null) {
    return snapshot;
  }
  for (final product in listed) {
    if (product.id == snapshot.id) {
      return product;
    }
  }
  return snapshot.withStockCount(0);
}

final companyProductsStreamProvider =
    StreamProvider.family<List<Product>, String>((ref, companyId) {
  if (companyId.isEmpty) {
    return Stream.value(const []);
  }
  return ref.watch(productsRepositoryProvider).watchCompanyProducts(companyId);
});
