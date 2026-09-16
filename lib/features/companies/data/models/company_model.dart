import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/company.dart';

class CompanyModel {
  CompanyModel._();

  static Company fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final map = doc.data() ?? const <String, dynamic>{};
    return Company(
      id: doc.id,
      name: map['name'] as String? ?? '',
      rating: (map['rating'] as num?)?.toDouble() ?? 0,
      reviewCount: (map['reviewCount'] as num?)?.toInt() ?? 0,
      logoUrl: map['logoUrl'] as String?,
      description: map['description'] as String?,
      city: map['city'] as String?,
      address: map['address'] as String?,
      phone: map['phone'] as String?,
      email: map['email'] as String?,
      pickupAddress: map['pickupAddress'] as String?,
    );
  }

  /// Only the fields a company admin is allowed to edit.
  static Map<String, dynamic> toEditableFields(Company company) {
    return {
      'name': company.name,
      'logoUrl': company.logoUrl ?? '',
      'description': company.description ?? '',
      'city': company.city ?? '',
      'address': company.address ?? '',
      'phone': company.phone ?? '',
      'email': company.email ?? '',
      'pickupAddress': company.pickupAddress ?? '',
    };
  }
}
