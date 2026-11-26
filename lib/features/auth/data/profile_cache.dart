import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/user_profile.dart';
import 'models/user_profile_model.dart';

/// Reads a person's profile from this phone's own copy of the database (no
/// network), or null when there is none yet. It lets the app open at once on
/// the profile it had last time while the server's copy is on its way.
typedef CachedProfileReader = Future<UserProfile?> Function(String userId);

final cachedProfileReaderProvider = Provider<CachedProfileReader>((ref) {
  return (userId) async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .get(const GetOptions(source: Source.cache));
      final data = doc.data();
      if (!doc.exists || data == null) return null;
      return UserProfileModel.fromFirestoreMap(data, doc.id);
    } catch (_) {
      // Nothing saved yet (first sign-in) or no Firebase here (tests).
      return null;
    }
  };
});
