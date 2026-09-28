import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../offers/domain/offer_pricing.dart';
import '../../domain/entities/company_service.dart';

class CompanyServiceModel extends CompanyService {
  const CompanyServiceModel({
    required super.id,
    required super.companyId,
    required super.serviceId,
    required super.isActive,
    required super.createdAt,
    super.price,
    super.note,
    super.offerPrice,
    super.offerEndsAt,
    super.offerBadge,
  });

  factory CompanyServiceModel.fromMap(String id, Map<String, dynamic> data) {
    final rawPrice = data['price'];
    final rawOfferPrice = data['offerPrice'];
    final rawOfferEndsAt = data['offerEndsAt'];
    return CompanyServiceModel(
      id: id,
      companyId: data['companyId'] as String? ?? '',
      serviceId: data['serviceId'] as String? ?? '',
      isActive: data['isActive'] as bool? ?? false,
      createdAt: data['createdAt'] is DateTime
          ? (data['createdAt'] as DateTime).toUtc()
          : DateTime.now().toUtc(),
      // Only a positive number is a price; anything else means "no price".
      price: rawPrice is num && rawPrice > 0 ? rawPrice.toDouble() : null,
      note: data['note'] as String?,
      offerPrice: rawOfferPrice is num && rawOfferPrice > 0
          ? rawOfferPrice.toDouble()
          : null,
      offerEndsAt: rawOfferEndsAt is DateTime
          ? rawOfferEndsAt
          : rawOfferEndsAt is Timestamp
              ? rawOfferEndsAt.toDate()
              : null,
      offerBadge: OfferBadge.parse(data['offerBadge']),
    );
  }

  Map<String, dynamic> toFirestoreMap() {
    return {
      'id': id,
      'companyId': companyId,
      'serviceId': serviceId,
      'isActive': isActive,
      'price': price,
      'note': note?.trim() ?? '',
    };
  }
}
