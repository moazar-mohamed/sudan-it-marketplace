import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/error_messages.dart';
import '../../../core/localization/locale_controller.dart';
import '../../companies/domain/entities/company.dart';
import '../../companies/domain/entities/payment_account.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../company_services/presentation/company_service_error_message.dart';
import '../../company_services/presentation/company_service_providers.dart';
import '../../notifications/presentation/notification_events.dart';
import '../../notifications/presentation/notifications_providers.dart';
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
    return _guard(() async {
      await _ref.read(ordersRepositoryProvider).updateOrderStatus(
            orderId: order.id,
            orderStatus: status,
          );
      await _notifyCustomerOfStatus(order, status);
    });
  }

  Future<String?> confirmPayment(OrderEntity order) {
    return _guard(() async {
      await _ref.read(ordersRepositoryProvider).confirmPayment(order.id);
      final notifications = _ref.read(notificationsRepositoryProvider);
      await notifications.createNotification(
        NotificationEvents.paymentConfirmed(
          id: notifications.newNotificationId(),
          orderId: order.id,
          customerId: order.customerId,
          productName: order.productName,
        ),
      );
    });
  }

  Future<void> _notifyCustomerOfStatus(
    OrderEntity order,
    OrderStatus status,
  ) async {
    final notifications = _ref.read(notificationsRepositoryProvider);
    final event = NotificationEvents.forOrderStatusChange(
      id: notifications.newNotificationId(),
      status: status,
      orderId: order.id,
      customerId: order.customerId,
      productName: order.productName,
    );
    if (event != null) {
      await notifications.createNotification(event);
    }
  }

  Future<String?> updateCompanyProfile(Company company) {
    return _guard(
      () => _ref.read(companiesRepositoryProvider).updateCompanyProfile(company),
    );
  }

  Future<String?> updatePaymentAccounts(
    String companyId,
    List<PaymentAccount> accounts,
  ) {
    return _guard(
      () => _ref
          .read(companiesRepositoryProvider)
          .updatePaymentAccounts(companyId, accounts),
    );
  }

  /// Creates the technician's login with a temporary password. The technician
  /// is made to choose their own password the first time they sign in.
  Future<String?> createTechnicianAccount({
    required String companyId,
    required String fullName,
    required String phone,
    required String email,
    required String password,
  }) {
    return _guard(
      () => _ref.read(techniciansRepositoryProvider).provisionTechnician(
            companyId: companyId,
            fullName: fullName,
            phone: phone,
            email: email,
            password: password,
          ),
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
    return _guard(() async {
      await _ref.read(ordersRepositoryProvider).assignTechnician(
            orderId: order.id,
            technicianId: technicianId,
            technicianName: technicianName,
          );
      final notifications = _ref.read(notificationsRepositoryProvider);
      await notifications.createNotification(
        NotificationEvents.technicianAssigned(
          id: notifications.newNotificationId(),
          orderId: order.id,
          technicianId: technicianId,
          productName: order.productName,
        ),
      );
    });
  }

  /// Starts offering a catalogue service. [price] is optional: null stores
  /// no price (never 0).
  Future<String?> addCompanyService({
    required String companyId,
    required String serviceId,
    double? price,
    String? note,
  }) {
    return _guardCompanyService(
      () => _ref.read(companyServiceRepositoryProvider).addServiceToCompany(
            companyId: companyId,
            serviceId: serviceId,
            price: price,
            note: note,
          ),
    );
  }

  Future<String?> updateCompanyService({
    required String companyServiceId,
    double? price,
    String? note,
  }) {
    return _guardCompanyService(
      () => _ref
          .read(companyServiceRepositoryProvider)
          .updateCompanyServiceDetails(
            companyServiceId: companyServiceId,
            price: price,
            note: note,
          ),
    );
  }

  Future<String?> removeCompanyService({
    required String companyId,
    required String serviceId,
  }) {
    return _guardCompanyService(
      () => _ref.read(companyServiceRepositoryProvider).removeServiceFromCompany(
            companyId: companyId,
            serviceId: serviceId,
          ),
    );
  }

  Future<String?> _guardCompanyService(Future<void> Function() action) async {
    try {
      await action();
      return null;
    } catch (error) {
      return companyServiceErrorMessage(
        _ref.read(appLocalizationsProvider),
        error,
      );
    }
  }

  Future<String?> _guard(Future<void> Function() action) async {
    try {
      await action();
      return null;
    } catch (error) {
      return localizedErrorMessage(_ref.read(appLocalizationsProvider), error);
    }
  }
}
