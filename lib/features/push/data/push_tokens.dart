import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

/// How many of a user's phones are remembered (the newest ones).
const maxPushTokens = 5;

/// [existing] with [token] moved (or added) last, keeping the newest
/// [maxPushTokens]. A phone that is used again stays; one never seen again
/// eventually drops off (the push relay also drops tokens FCM rejects).
List<String> nextPushTokens(List<String> existing, String token) {
  final next = [...existing.where((known) => known != token), token];
  return next.length > maxPushTokens
      ? next.sublist(next.length - maxPushTokens)
      : next;
}

/// [existing] without [token].
List<String> withoutPushToken(List<String> existing, String token) =>
    existing.where((known) => known != token).toList();

/// The phones (FCM device tokens) that receive a user's pushes, kept on
/// their profile as `users/{uid}.fcmTokens`.
class FirestorePushTokens {
  FirestorePushTokens({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  Future<void> register(String uid, String token) {
    final profile = _firestore.collection('users').doc(uid);
    return _firestore.runTransaction((transaction) async {
      final snapshot = await transaction.get(profile);
      if (!snapshot.exists) return;
      final existing = (snapshot.data()?['fcmTokens'] as List?)
              ?.whereType<String>()
              .toList() ??
          const <String>[];
      final next = nextPushTokens(existing, token);
      if (listEquals(next, existing)) return;
      transaction.update(profile, {'fcmTokens': next});
    });
  }

  /// Stops sending this phone's pushes to [uid] (the switch was turned off).
  Future<void> unregister(String uid, String token) {
    final profile = _firestore.collection('users').doc(uid);
    return _firestore.runTransaction((transaction) async {
      final snapshot = await transaction.get(profile);
      if (!snapshot.exists) return;
      final existing = (snapshot.data()?['fcmTokens'] as List?)
              ?.whereType<String>()
              .toList() ??
          const <String>[];
      final next = withoutPushToken(existing, token);
      if (listEquals(next, existing)) return;
      transaction.update(profile, {'fcmTokens': next});
    });
  }
}
