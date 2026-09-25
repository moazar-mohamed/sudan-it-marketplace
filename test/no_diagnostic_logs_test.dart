import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/logging/debug_log.dart';

/// Diagnostic output must never reach a release build's device log: it carried
/// e-mail addresses, user ids and error details. Everything goes through
/// [debugLog], which prints only in debug builds.
void main() {
  test('app code has no raw print/debugPrint and no DIAG logging', () {
    final offenders = <String>[];
    for (final entity in Directory('lib').listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final path = entity.path.replaceAll(r'\', '/');
      if (path.endsWith('core/logging/debug_log.dart')) continue;
      final lines = entity.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        final line = lines[i];
        if (RegExp(r'(^|[^A-Za-z_])(print|debugPrint)\(').hasMatch(line) ||
            RegExp(r"debugLog\(\s*''").hasMatch(line) || // every log names its source
            line.contains('[DIAG]') ||
            line.contains('avoid_print')) {
          offenders.add('$path:${i + 1}');
        }
      }
    }
    expect(offenders, isEmpty, reason: 'use debugLog(tag, message) instead');
  });

  test('nothing in the login flow logs an e-mail address or user id', () {
    final gate = File('lib/features/auth/presentation/auth_gate.dart').readAsStringSync();
    final profiles = File(
      'lib/features/auth/data/datasources/firestore_user_profile_remote_data_source.dart',
    ).readAsStringSync();
    expect(gate, isNot(contains('authEmail=')));
    expect(profiles, isNot(contains('uid=')));
  });

  test('debugLog is callable and never throws', () {
    expect(() => debugLog('Test', 'message'), returnsNormally);
  });
}
