import 'package:flutter/foundation.dart';

/// Developer diagnostics. Prints only in debug builds, so a release build never
/// writes error details (or anything else) to the device log. Never pass an
/// e-mail address, user id, token or other personal data to it.
void debugLog(String tag, Object? message) {
  if (kDebugMode) {
    debugPrint('[$tag] $message');
  }
}
