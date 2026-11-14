import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/push/push_relay.dart';
import 'package:sudan_it_marketplace/features/notifications/data/platform_notice.dart';

import 'helpers/fake_firestore.dart';

/// Remembers which notifications it was asked to push.
class _RecordingRelay implements PushRelay {
  final pushed = <String>[];

  @override
  bool get isEnabled => true;

  @override
  Future<void> notification(String notificationId) async => pushed.add(notificationId);

  @override
  dynamic noSuchMethod(Invocation invocation) => Future<void>.value();
}

void main() {
  group('telling the Platform Admins', () {
    test('a new report: one notice for the whole team, named by its subject, and a push', () async {
      final firestore = FakeFirestore();
      final relay = _RecordingRelay();
      await notifyPlatformAdmins(
        firestore: firestore,
        pushRelay: relay,
        type: PlatformNoticeType.newReport,
        subjectId: 'r1',
        senderId: 'cust1',
        name: 'Late delivery',
      );
      final stored = firestore.read('notifications/r1_new_report');
      expect(stored, isNotNull);
      expect(stored!['recipientType'], 'platform_admin');
      expect(stored['recipientId'], 'platform');
      expect(stored['reportId'], 'r1');
      expect(stored['type'], 'new_report');
      expect(stored['productName'], 'Late delivery');
      expect(stored['senderId'], 'cust1');
      expect(stored['isRead'], false);
      expect(stored.containsKey('title'), isFalse);
      expect(stored.containsKey('body'), isFalse);
      expect(relay.pushed, ['r1_new_report']);
    });

    test('a low rating is named by the rated item and keyed by the review', () async {
      final firestore = FakeFirestore();
      final relay = _RecordingRelay();
      await notifyPlatformAdmins(
        firestore: firestore,
        pushRelay: relay,
        type: PlatformNoticeType.lowReview,
        subjectId: 'v1',
        senderId: 'cust1',
        name: 'Printer X',
      );
      final stored = firestore.read('notifications/v1_low_review')!;
      expect(stored['reviewId'], 'v1');
      expect(stored.containsKey('reportId'), isFalse);
      expect(stored['type'], 'low_review');
      expect(relay.pushed, ['v1_low_review']);
    });

    test('a refused notice is not pushed and never throws', () async {
      final firestore = FakeFirestore()..rejectCommit = (_) => 'permission-denied';
      final relay = _RecordingRelay();
      await notifyPlatformAdmins(
        firestore: firestore,
        pushRelay: relay,
        type: PlatformNoticeType.newReport,
        subjectId: 'r1',
        senderId: 'cust1',
        name: 'Late delivery',
      );
      expect(relay.pushed, isEmpty);
    });

    test('a low rating is 1 or 2 stars, as the rules say', () {
      expect(lowReviewMaxStars, 2);
    });
  });
}
