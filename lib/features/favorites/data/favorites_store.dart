import 'package:cloud_firestore/cloud_firestore.dart';

import '../domain/favorite.dart';

/// `users/{uid}/favorites/{key}`: private to the customer.
class FavoritesStore {
  FavoritesStore({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> _favorites(String uid) =>
      _firestore.collection('users').doc(uid).collection('favorites');

  /// Newest first, sorted here so no index is needed.
  Stream<List<Favorite>> watch(String uid) {
    return _favorites(uid).snapshots().map((snapshot) {
      final favorites = <Favorite>[];
      for (final doc in snapshot.docs) {
        final data = doc.data();
        final kind = FavoriteKind.fromValue(data['kind']);
        final targetId = data['targetId'];
        if (kind == null || targetId is! String) continue;
        final createdAt = data['createdAt'];
        favorites.add(
          Favorite(
            kind: kind,
            targetId: targetId,
            name: data['name'] as String? ?? '',
            // A just-written server time is null until the server confirms it.
            createdAt: createdAt is Timestamp
                ? createdAt.toDate()
                : DateTime.now(),
          ),
        );
      }
      favorites.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return favorites;
    });
  }

  Future<void> add(String uid, FavoriteKind kind, String targetId, String name) {
    return _favorites(uid).doc(Favorite.keyFor(kind, targetId)).set({
      'kind': kind.name,
      'targetId': targetId,
      'name': name.length > 200 ? name.substring(0, 200) : name,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> remove(String uid, FavoriteKind kind, String targetId) {
    return _favorites(uid).doc(Favorite.keyFor(kind, targetId)).delete();
  }

  /// Whether the item is still in the catalogue at all, stocked or not. Kept as
  /// true when it cannot be told, so a bad connection hides nothing.
  Future<bool> targetExists(FavoriteKind kind, String targetId) async {
    final collection = kind == FavoriteKind.product ? 'products' : 'services';
    try {
      return (await _firestore.collection(collection).doc(targetId).get()).exists;
    } on FirebaseException {
      return true;
    }
  }
}
