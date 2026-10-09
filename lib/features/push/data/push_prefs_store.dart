import 'package:cloud_firestore/cloud_firestore.dart';

import '../domain/push_categories.dart';

/// Where the kinds of push a person wants are kept: `users/{uid}.pushPrefs`.
class FirestorePushPrefs {
  FirestorePushPrefs({FirebaseFirestore? firestore}) : _injected = firestore;

  final FirebaseFirestore? _injected;

  // Looked up when first needed, so building this (as a provider does) needs
  // no Firebase app.
  FirebaseFirestore get _firestore => _injected ?? FirebaseFirestore.instance;

  /// The person's choices, live (everything on while none were saved).
  Stream<PushPrefs> watch(String uid) {
    return _firestore.collection('users').doc(uid).snapshots().map(
          (snapshot) => PushPrefs.fromMap(snapshot.data()?['pushPrefs']),
        );
  }

  /// Saves one kind on or off, leaving the others as they are.
  Future<void> set(String uid, PushCategory category, bool enabled) {
    return _firestore
        .collection('users')
        .doc(uid)
        .update({'pushPrefs.${category.key}': enabled});
  }
}
