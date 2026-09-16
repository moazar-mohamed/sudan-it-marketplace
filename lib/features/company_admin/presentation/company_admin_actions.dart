import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../companies/domain/entities/company.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../orders/domain/entities/order_entity.dart';
import '../../orders/presentation/orders_providers.dart';
import '../../products/domain/entities/product.dart';
import '../../products/presentation/products_providers.dart';
import '../../technicians/domain/entities/technician.dart';
import '../../technicians/presentation/technicians_providers.dart';

final companyAdminActionsProvider = Provider<CompanyAdminActions>((ref) {
  return CompanyAdminActions(ref);
});

/// Write operations used by the Company Admin screens. Each method returns
/// null on success or a user-facing error message.
class CompanyAdminActions {
  CompanyAdminActions(this._ref);

  final Ref _ref;

  String newProductId() =>
      _ref.read(productsRepositoryProvider).newProductId();

  Future<String?> createProduct(Product product) {
    return _guard(
      () => _ref.read(productsRepositoryProvider).createProduct(product),
    );
  }

  Future<String?> updateProduct(Product product) {
    return _guard(
      () => _ref.read(productsRepositoryProvider).updateProduct(product),
    );
  }

  Future<String?> deleteProduct(String productId) {
    return _guard(
      () => _ref.read(productsRepositoryProvider).deleteProduct(productId),
    );
  }

  Future<String?> advanceOrderStatus(OrderEntity order, OrderStatus status) {
    return _guard(
      () => _ref.read(ordersRepositoryProvider).updateOrderStatus(
            orderId: order.id,
            orderStatus: status,
          ),
    );
  }

  Future<String?> confirmPayment(OrderEntity order) {
    return _guard(
      () => _ref.read(ordersRepositoryProvider).confirmPayment(order.id),
    );
  }

  Future<String?> updateCompanyProfile(Company company) {
    return _guard(
      () => _ref.read(companiesRepositoryProvider).updateCompanyProfile(company),
    );
  }

  String newTechnicianId() =>
      _ref.read(techniciansRepositoryProvider).newTechnicianId();

  Future<String?> createTechnician(Technician technician) {
    return _guard(
      () => _ref.read(techniciansRepositoryProvider).createTechnician(technician),
    );
  }

  Future<String?> updateTechnician(Technician technician) {
    return _guard(
      () => _ref.read(techniciansRepositoryProvider).updateTechnician(technician),
    );
  }

  Future<String?> deactivateTechnician(String technicianId) {
    return _guard(
      () => _ref
          .read(techniciansRepositoryProvider)
          .deactivateTechnician(technicianId),
    );
  }

  Future<String?> assignTechnician(
    OrderEntity order, {
    required String technicianId,
    required String technicianName,
  }) {
    return _guard(
      () => _ref.read(ordersRepositoryProvider).assignTechnician(
            orderId: order.id,
            technicianId: technicianId,
            technicianName: technicianName,
          ),
    );
  }

  Future<String?> _guard(Future<void> Function() action) async {
    try {
      await action();
      return null;
    } catch (error) {
      final message = error.toString();
      return message.startsWith('Exception: ')
          ? message.substring('Exception: '.length)
          : message;
    }
  }
}
