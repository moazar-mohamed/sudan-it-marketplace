import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../location/domain/geo_location.dart';
import '../../domain/entities/company.dart';

class CompanyModel {
  CompanyModel._();

  static Company fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    return fromMap(doc.id, doc.data() ?? const <String, dynamic>{});
  }

  static Company fromMap(String id, Map<String, dynamic> map) {
    // Coordinates are optional; a legacy document without them (or with a
    // non-numeric value) simply has none and keeps working from its text.
    final coordinates = GeoLocation.tryCreate(map['latitude'], map['longitude']);
    return Company(
      id: id,
      name: map['name'] as String? ?? '',
      rating: (map['rating'] as num?)?.toDouble() ?? 0,
      reviewCount: (map['reviewCount'] as num?)?.toInt() ?? 0,
      logoUrl: map['logoUrl'] as String?,
      description: map['description'] as String?,
      city: map['city'] as String?,
      address: map['address'] as String?,
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      phone: map['phone'] as String?,
      email: map['email'] as String?,
      pickupAddress: map['pickupAddress'] as String?,
      status: _parseStatus(map['status']),
    );
  }

  static String _parseStatus(Object? value) {
    return value is String &&
            (value == 'pending' || value == 'rejected' || value == 'inactive')
        ? value
        : 'active';
  }

  /// Only the fields a company admin is allowed to edit. Coordinates are
  /// written as numbers, or removed entirely when the admin cleared them (a
  /// company that never had any is left untouched).
  static Map<String, dynamic> toEditableFields(Company company) {
    final coordinates = company.coordinates;
    return {
      'name': company.name,
      'logoUrl': company.logoUrl ?? '',
      'description': company.description ?? '',
      'city': company.city ?? '',
      'address': company.address ?? '',
      'latitude': coordinates?.latitude ?? FieldValue.delete(),
      'longitude': coordinates?.longitude ?? FieldValue.delete(),
      'phone': company.phone ?? '',
      'email': company.email ?? '',
      'pickupAddress': company.pickupAddress ?? '',
    };
  }
}
