import 'dart:async';
import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../logging/debug_log.dart';

/// Where the push relay (`push_relay/` in this repository) is deployed, for
/// example `https://sudan-it-push.<account>.workers.dev`. Left empty, phone
/// pushes are off and the app keeps its in-app notifications only.
const pushRelayUrl = String.fromEnvironment('PUSH_RELAY_URL');

/// Asks the push relay to send something that was just written to Firestore
/// to the recipients' phones. The relay reads it back and checks the caller
/// wrote it, so nothing but ids travels from here.
abstract class PushRelay {
  bool get isEnabled;

  /// A notification document (`notifications/{id}`) this user just created.
  Future<void> notification(String notificationId);

  /// A chat message this user just sent.
  Future<void> chatMessage({required String chatId, required String messageId});
}

/// Pushes switched off: nothing is sent.
class NoPushRelay implements PushRelay {
  const NoPushRelay();

  @override
  bool get isEnabled => false;

  @override
  Future<void> notification(String notificationId) async {}

  @override
  Future<void> chatMessage({
    required String chatId,
    required String messageId,
  }) async {}
}

/// Calls the relay over HTTPS, signed with the user's Firebase ID token. A
/// push is a best-effort extra: failures are logged, never shown or thrown.
class HttpPushRelay implements PushRelay {
  HttpPushRelay({
    required String baseUrl,
    required this.idToken,
    http.Client? client,
    this.timeout = const Duration(seconds: 15),
  })  : _baseUrl = baseUrl.endsWith('/')
            ? baseUrl.substring(0, baseUrl.length - 1)
            : baseUrl,
        _client = client ?? http.Client();

  final String _baseUrl;

  /// The signed-in user's Firebase ID token (null when signed out).
  final Future<String?> Function() idToken;
  final http.Client _client;
  final Duration timeout;

  @override
  bool get isEnabled => true;

  @override
  Future<void> notification(String notificationId) =>
      _send({'notificationId': notificationId});

  @override
  Future<void> chatMessage({
    required String chatId,
    required String messageId,
  }) =>
      _send({'chatId': chatId, 'messageId': messageId});

  Future<void> _send(Map<String, String> body) async {
    try {
      final token = await idToken();
      if (token == null) return;
      final response = await _client
          .post(
            Uri.parse('$_baseUrl/push'),
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
            },
            body: jsonEncode(body),
          )
          .timeout(timeout);
      if (response.statusCode >= 300) {
        debugLog('PushRelay', '${response.statusCode} ${response.body}');
      }
    } catch (error) {
      debugLog('PushRelay', 'push not sent: $error');
    }
  }
}

final pushRelayProvider = Provider<PushRelay>((ref) {
  if (pushRelayUrl.isEmpty) return const NoPushRelay();
  return HttpPushRelay(
    baseUrl: pushRelayUrl,
    idToken: () async => FirebaseAuth.instance.currentUser?.getIdToken(),
  );
});
