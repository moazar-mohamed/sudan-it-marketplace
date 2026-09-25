import '../../../location/domain/geo_location.dart';
import '../../../../core/utils/short_id.dart';

/// Lifecycle of a service request:
/// pending -> accepted | rejected | cancelled (by the customer),
/// accepted -> in_progress -> completed.
enum ServiceRequestStatus {
  pending('pending'),
  accepted('accepted'),
  rejected('rejected'),
  inProgress('in_progress'),
  completed('completed'),
  cancelled('cancelled');

  const ServiceRequestStatus(this.value);

  final String value;

  static ServiceRequestStatus fromValue(String? value) {
    for (final status in values) {
      if (status.value == value) return status;
    }
    return ServiceRequestStatus.pending;
  }

  /// No further change can happen to a request in this status.
  bool get isFinal =>
      this == rejected || this == completed || this == cancelled;
}

/// A customer's request for one company to perform one catalogue service.
/// Separate from product orders: no stock, delivery or payment.
class ServiceRequest {
  const ServiceRequest({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.companyId,
    required this.companyName,
    required this.companyServiceId,
    required this.serviceId,
    required this.serviceName,
    required this.details,
    required this.address,
    required this.contactPhone,
    required this.status,
    required this.createdAt,
    this.price,
    this.latitude,
    this.longitude,
    this.updatedAt,
  });

  final String id;
  final String customerId;
  final String customerName;
  final String companyId;
  final String companyName;
  final String companyServiceId;
  final String serviceId;
  final String serviceName;

  /// The company's price for the service when the request was sent, or null
  /// when the company had set none (then nothing is shown).
  final double? price;

  /// What the customer needs, in their own words.
  final String details;

  /// Where the service is needed: a written address, a map point, both or
  /// neither (some services are done remotely).
  final String address;
  final double? latitude;
  final double? longitude;
  final String contactPhone;
  final ServiceRequestStatus status;
  final DateTime createdAt;
  final DateTime? updatedAt;

  String get shortId => shortReference(id);

  GeoLocation? get coordinates => GeoLocation.tryCreate(latitude, longitude);

  String? get addressText {
    final text = address.trim();
    return text.isEmpty ? null : text;
  }

  bool get hasLocation => coordinates != null || addressText != null;

  /// The customer may cancel only while the company has not answered yet.
  bool get canCustomerCancel => status == ServiceRequestStatus.pending;
}
