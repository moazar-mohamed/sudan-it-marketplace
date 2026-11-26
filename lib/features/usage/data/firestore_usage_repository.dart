import 'package:cloud_firestore/cloud_firestore.dart';

import '../domain/usage_repository.dart';

/// `usage_days/{day}_{uid}` and `product_stats/{productId}` (see
/// firestore.rules: written in the person's own name, read only by Platform
/// Admin).
class FirestoreUsageRepository implements UsageRepository {
  FirestoreUsageRepository({FirebaseFirestore? firestore})
      : _override = firestore;

  final FirebaseFirestore? _override;

  // Looked up when used, so building the repository never needs Firebase.
  FirebaseFirestore get _firestore => _override ?? FirebaseFirestore.instance;

  @override
  Future<void> recordActiveDay({
    required String day,
    required String userId,
    required String role,
  }) {
    return _firestore.collection('usage_days').doc('${day}_$userId').set({
      'day': day,
      'userId': userId,
      'role': role,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  @override
  Future<void> recordProductView({
    required String productId,
    required String userId,
  }) {
    // The customer's marker for this product moves to now and the count goes
    // up by one, in one write: the rules accept the pair at most once in any
    // 24 hours (product_views/{productId}_{uid}).
    final batch = _firestore.batch()
      ..set(_firestore.collection('product_views').doc('${productId}_$userId'), {
        'productId': productId,
        'userId': userId,
        'lastAt': FieldValue.serverTimestamp(),
      })
      ..set(
        _firestore.collection('product_stats').doc(productId),
        {
          'views': FieldValue.increment(1),
          'updatedAt': FieldValue.serverTimestamp(),
        },
        SetOptions(merge: true),
      );
    return batch.commit();
  }
}
