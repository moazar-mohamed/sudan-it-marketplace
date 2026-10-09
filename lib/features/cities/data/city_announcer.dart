import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import '../../../core/logging/debug_log.dart';
import '../../../core/push/push_relay.dart';

/// Tells the customers of a city that a company now serves it.
///
/// For each city the company has just added, it writes one
/// `city_announcements/{companyId}_{cityId}` document (the security rules allow
/// that once per company and city, ever, so adding the same city again stays
/// quiet) and asks the push relay to send it. Everything here is best effort:
/// saving the company's cities never waits for it and never fails because of
/// it.
class CityAnnouncer {
  CityAnnouncer({required this.write, required this.push});

  /// Most cities announced from one save, so one company cannot flood phones.
  static const maxPerSave = 10;

  /// Writes the announcement; true when it was created (false when it already
  /// existed or the rules refused it).
  final Future<bool> Function({
    required String companyId,
    required String companyName,
    required String cityId,
  }) write;

  /// Asks the relay to send the announcement with this id.
  final Future<void> Function(String announcementId) push;

  /// The cities in [after] that [before] did not have, in order.
  static List<String> addedCities(
    Iterable<String> before,
    Iterable<String> after,
  ) {
    final had = before.toSet();
    return [
      for (final id in after)
        if (!had.contains(id)) id,
    ];
  }

  Future<void> announce({
    required String companyId,
    required String companyName,
    required Iterable<String> cityIds,
  }) async {
    for (final cityId in cityIds.take(maxPerSave)) {
      try {
        final created = await write(
          companyId: companyId,
          companyName: companyName,
          cityId: cityId,
        );
        if (created) await push('${companyId}_$cityId');
      } catch (error) {
        debugLog('CityAnnouncer', 'not announced $cityId: $error');
      }
    }
  }

  /// The announcer that talks to Firestore and the relay. With no relay
  /// configured it does nothing (nobody could be told anyway).
  factory CityAnnouncer.live({http.Client? client}) {
    if (pushRelayUrl.isEmpty) {
      return CityAnnouncer(
        write: ({required companyId, required companyName, required cityId}) async => false,
        push: (_) async {},
      );
    }
    final base = pushRelayUrl.endsWith('/')
        ? pushRelayUrl.substring(0, pushRelayUrl.length - 1)
        : pushRelayUrl;
    final httpClient = client ?? http.Client();
    return CityAnnouncer(
      write: ({
        required String companyId,
        required String companyName,
        required String cityId,
      }) async {
        final uid = FirebaseAuth.instance.currentUser?.uid;
        if (uid == null) return false;
        try {
          await FirebaseFirestore.instance
              .collection('city_announcements')
              .doc('${companyId}_$cityId')
              .set({
            'companyId': companyId,
            'companyName': companyName,
            'cityId': cityId,
            'senderId': uid,
            'createdAt': FieldValue.serverTimestamp(),
          });
          return true;
        } on FirebaseException {
          // Already announced, or not allowed: say nothing.
          return false;
        }
      },
      push: (announcementId) async {
        final token = await FirebaseAuth.instance.currentUser?.getIdToken();
        if (token == null) return;
        await httpClient
            .post(
              Uri.parse('$base/push'),
              headers: {
                'Authorization': 'Bearer $token',
                'Content-Type': 'application/json',
              },
              body: jsonEncode({'cityAnnouncementId': announcementId}),
            )
            .timeout(const Duration(seconds: 15));
      },
    );
  }
}
