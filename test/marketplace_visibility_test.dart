import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/companies/domain/entities/company.dart';
import 'package:sudan_it_marketplace/features/companies/presentation/companies_providers.dart';
import 'package:sudan_it_marketplace/features/products/domain/entities/product.dart';
import 'package:sudan_it_marketplace/features/products/presentation/products_providers.dart';

Company _company(String id, [String status = 'active']) => Company(
      id: id,
      name: 'Company $id',
      rating: 0,
      reviewCount: 0,
      status: status,
    );

Product _product(String id, String? companyId) =>
    Product(id: id, name: 'Product $id', price: 1, companyId: companyId);

void main() {
  group('company visibility', () {
    test('only active companies are shown to customers', () {
      final visible = activeCompanies([
        _company('a'),
        _company('p', 'pending'),
        _company('r', 'rejected'),
        _company('i', 'inactive'),
      ]);
      expect(visible.map((c) => c.id), ['a']);
    });

    test('a company without a stored status counts as active', () {
      const legacy = Company(id: 'l', name: 'Legacy', rating: 0, reviewCount: 0);
      expect(legacy.isActive, isTrue);
    });
  });

  group('product visibility follows the company', () {
    final products = [
      _product('p1', 'active'),
      _product('p2', 'inactive'),
      _product('p3', 'deleted'),
      _product('p4', null),
    ];

    test('products of inactive or deleted companies are hidden', () {
      final visible = productsOfActiveCompanies(products, [
        _company('active'),
        _company('inactive', 'inactive'),
      ]);
      expect(visible.map((p) => p.id), ['p1', 'p4']);
    });

    test('products reappear when the company is reactivated', () {
      final visible = productsOfActiveCompanies(products, [
        _company('active'),
        _company('inactive'),
      ]);
      expect(visible.map((p) => p.id), ['p1', 'p2', 'p4']);
    });

    test('company products stay hidden until the company list has loaded', () {
      expect(productsOfActiveCompanies(products, null).map((p) => p.id), ['p4']);
    });
  });
}
