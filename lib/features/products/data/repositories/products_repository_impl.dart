import '../../domain/entities/product.dart';
import '../../domain/repositories/products_repository.dart';
import '../datasources/products_remote_data_source.dart';

class ProductsRepositoryImpl implements ProductsRepository {
  const ProductsRepositoryImpl(this._remoteDataSource);

  final ProductsRemoteDataSource _remoteDataSource;

  @override
  Stream<List<Product>> watchMarketplaceProducts() =>
      _remoteDataSource.watchMarketplaceProducts();

  @override
  Stream<List<Product>> watchCompanyProducts(String companyId) =>
      _remoteDataSource.watchCompanyProducts(companyId);

  @override
  String newProductId() => _remoteDataSource.newProductId();

  @override
  Future<void> createProduct(Product product) =>
      _remoteDataSource.createProduct(product);

  @override
  Future<void> updateProduct(Product product) =>
      _remoteDataSource.updateProduct(product);

  @override
  Future<void> deleteProduct(String productId) =>
      _remoteDataSource.deleteProduct(productId);
}
