import '../entities/product.dart';

abstract interface class ProductsRepository {
  Stream<List<Product>> watchMarketplaceProducts();

  Stream<List<Product>> watchCompanyProducts(String companyId);

  String newProductId();

  Future<void> createProduct(Product product);

  Future<void> updateProduct(Product product);

  Future<void> deleteProduct(String productId);
}
