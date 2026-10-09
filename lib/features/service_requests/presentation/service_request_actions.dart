import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/error_messages.dart';
import '../../../core/localization/locale_controller.dart';
import '../../chats/presentation/chat_providers.dart';
import '../../cities/presentation/city_providers.dart';
import '../../companies/domain/entities/company.dart';
import '../../company_services/domain/entities/company_service.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../../location/domain/geo_location.dart';
import '../../notifications/domain/entities/app_notification.dart';
import '../../notifications/presentation/notification_events.dart';
import '../../notifications/presentation/notifications_providers.dart';
import '../../services/domain/entities/catalog_service.dart';
import '../domain/entities/service_request.dart';
import 'service_request_providers.dart';

final serviceRequestActionsProvider = Provider<ServiceRequestActions>((ref) {
  return ServiceRequestActions(ref);
});

typedef ServiceRequestSubmitResult = ({String? requestId, String? error});

/// Writes made from the service request screens. Methods return null (or a
/// result without an error) on success, otherwise a user-facing message.
class ServiceRequestActions {
  ServiceRequestActions(this._ref);

  final Ref _ref;

  /// Sends a request for [service] to [company] through its [offer], and
  /// opens the request's conversation. The request id is also the chat id.
  Future<ServiceRequestSubmitResult> submit({
    required CatalogService service,
    required CompanyService offer,
    required Company company,
    required String details,
    required String address,
    required GeoLocation? location,
    required String contactPhone,
  }) async {
    final customerId = _ref.read(currentUserIdProvider);
    if (customerId == null) {
      return (
        requestId: null,
        error: _ref.read(appLocalizationsProvider).errorPermissionDenied,
      );
    }
    if (!company.servesCity(_ref.read(customerCityIdProvider))) {
      return (
        requestId: null,
        error: _ref.read(appLocalizationsProvider).cityNotServed,
      );
    }
    final repository = _ref.read(serviceRequestsRepositoryProvider);
    final customerName =
        _ref.read(profileControllerProvider).asData?.value?.fullName ?? '';
    final request = ServiceRequest(
      id: repository.newServiceRequestId(),
      customerId: customerId,
      customerName: customerName,
      companyId: company.id,
      companyName: company.name,
      companyServiceId: offer.id,
      serviceId: service.id,
      serviceName: service.name,
      // The company's price as it is now (the offer price while an offer
      // runs), or none.
      price: offer.salePrice,
      details: details,
      address: address,
      latitude: location?.latitude,
      longitude: location?.longitude,
      contactPhone: contactPhone,
      status: ServiceRequestStatus.pending,
      createdAt: DateTime.now(),
    );
    try {
      await repository.createServiceRequest(request);
      await _notify(
        NotificationEvents.newServiceRequest(
          serviceRequestId: request.id,
          companyId: request.companyId,
          serviceName: request.serviceName,
        ),
      );
      return (requestId: request.id, error: null);
    } catch (error) {
      return (requestId: null, error: _message(error));
    }
  }

  Future<String?> cancel(ServiceRequest request) =>
      updateStatus(request, ServiceRequestStatus.cancelled);

  Future<String?> updateStatus(
    ServiceRequest request,
    ServiceRequestStatus status,
  ) async {
    try {
      await _ref
          .read(serviceRequestsRepositoryProvider)
          .updateStatus(requestId: request.id, status: status);
      await _notify(
        NotificationEvents.forServiceRequestStatus(
          status: status,
          serviceRequestId: request.id,
          customerId: request.customerId,
          companyId: request.companyId,
          serviceName: request.serviceName,
        ),
      );
      return null;
    } catch (error) {
      return _message(error);
    }
  }

  /// Tells the other side (in the app and on their phone). A notification
  /// that cannot be sent never undoes the request or its new status.
  Future<void> _notify(AppNotification? notification) async {
    if (notification == null) return;
    try {
      await _ref
          .read(notificationsRepositoryProvider)
          .createNotification(notification);
    } catch (_) {}
  }

  String _message(Object error) =>
      localizedErrorMessage(_ref.read(appLocalizationsProvider), error);
}
