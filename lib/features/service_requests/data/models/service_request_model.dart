import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/service_request.dart';

/// Firestore mapping of `service_requests/{id}`.
class ServiceRequestModel {
  const ServiceRequestModel._();

  static ServiceRequest fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? const <String, dynamic>{};
    final rawPrice = data['price'];
    final rawLatitude = data['latitude'];
    final rawLongitude = data['longitude'];
    return ServiceRequest(
      id: snapshot.id,
      customerId: data['customerId'] as String? ?? '',
      customerName: data['customerName'] as String? ?? '',
      companyId: data['companyId'] as String? ?? '',
      companyName: data['companyName'] as String? ?? '',
      companyServiceId: data['companyServiceId'] as String? ?? '',
      serviceId: data['serviceId'] as String? ?? '',
      serviceName: data['serviceName'] as String? ?? '',
      price: rawPrice is num && rawPrice > 0 ? rawPrice.toDouble() : null,
      details: data['details'] as String? ?? '',
      address: data['address'] as String? ?? '',
      latitude: rawLatitude is num ? rawLatitude.toDouble() : null,
      longitude: rawLongitude is num ? rawLongitude.toDouble() : null,
      contactPhone: data['contactPhone'] as String? ?? '',
      status: ServiceRequestStatus.fromValue(data['status'] as String?),
      // A just-written server timestamp is null until the server confirms it.
      createdAt: _date(data['createdAt']) ?? DateTime.now(),
      updatedAt: _date(data['updatedAt']),
    );
  }

  /// The document a customer writes when sending [request]. The price is
  /// left null (never 0) when the company set none.
  static Map<String, dynamic> toCreateMap(ServiceRequest request) {
    final coordinates = request.coordinates;
    return {
      'id': request.id,
      'customerId': request.customerId,
      'customerName': request.customerName.trim(),
      'companyId': request.companyId,
      'companyName': request.companyName,
      'companyServiceId': request.companyServiceId,
      'serviceId': request.serviceId,
      'serviceName': request.serviceName,
      'price': request.price,
      'details': request.details.trim(),
      'address': request.address.trim(),
      'latitude': coordinates?.latitude,
      'longitude': coordinates?.longitude,
      'contactPhone': request.contactPhone.trim(),
      'status': ServiceRequestStatus.pending.value,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  static DateTime? _date(Object? value) {
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }
}
