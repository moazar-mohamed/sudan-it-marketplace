import '../../domain/entities/product.dart';

abstract interface class ProductsRemoteDataSource {
  Stream<List<Product>> watchAllProducts();

  Stream<List<Product>> watchCompanyProducts(String companyId);

  String newProductId();

  Future<void> createProduct(Product product);

  Future<void> updateProduct(Product product);

  Future<void> deleteProduct(String productId);
}
