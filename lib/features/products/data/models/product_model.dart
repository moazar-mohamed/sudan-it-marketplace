import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/product.dart';

class ProductModel {
  ProductModel._();

  static Product fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final map = doc.data() ?? const <String, dynamic>{};
    final rawSpecs = map['specifications'];
    final specs = <String, String>{};
    if (rawSpecs is Map) {
      rawSpecs.forEach((key, value) {
        specs['$key'] = '$value';
      });
    }
    final rawCreatedAt = map['createdAt'];
    return Product(
      id: doc.id,
      name: map['name'] as String? ?? '',
      price: (map['price'] as num?)?.toDouble(),
      currency: map['currency'] as String? ?? 'SDG',
      imageUrl: map['imageUrl'] as String?,
      companyId: map['companyId'] as String?,
      companyName: map['companyName'] as String?,
      categoryId: map['categoryId'] as String?,
      description: map['description'] as String?,
      inStock: map['inStock'] as bool? ?? true,
      stockCount: (map['stockCount'] as num?)?.toInt() ?? 0,
      specifications: specs,
      isDeliveryAvailable: map['isDeliveryAvailable'] as bool? ?? true,
      isInstallationAvailable: map['isInstallationAvailable'] as bool? ?? false,
      installationPrice: (map['installationPrice'] as num?)?.toDouble(),
      createdAt: rawCreatedAt is Timestamp ? rawCreatedAt.toDate() : null,
    );
  }

  /// Fields shared by create and update. Installation price is stored only
  /// when installation is enabled so the two settings can never disagree.
  static Map<String, dynamic> toFirestoreFields(Product product) {
    return {
      'id': product.id,
      'companyId': product.companyId ?? '',
      'companyName': product.companyName ?? '',
      'name': product.name,
      'imageUrl': product.imageUrl ?? '',
      // Reference into the official `categories` collection. Null means no
      // category has been assigned; existing products are never migrated.
      'categoryId': product.categoryId,
      // null (not 0) when the company left the price out.
      'price': product.price,
      'currency': product.currency,
      'stockCount': product.stockCount,
      'inStock': product.inStock,
      'description': product.description ?? '',
      'specifications': product.specifications,
      'isDeliveryAvailable': product.isDeliveryAvailable,
      'isInstallationAvailable': product.isInstallationAvailable,
      'installationPrice': product.isInstallationAvailable
          ? (product.installationPrice ?? 0)
          : null,
    };
  }
}
