import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../core/push/push_relay.dart';

/// What the Platform Admins are told about: a new report, or a 1 or 2 star
/// rating. Each kind names its subject by its own key.
enum PlatformNoticeType {
  newReport('new_report', 'reportId'),
  lowReview('low_review', 'reviewId');

  const PlatformNoticeType(this.value, this.subjectKey);

  final String value;
  final String subjectKey;
}

/// The highest rating that tells the Platform Admins (firestore.rules checks
/// the same number).
const lowReviewMaxStars = 2;

/// Tells every Platform Admin about [subjectId] (a report or a review the
/// signed-in person [senderId] just wrote), in their web panel and as a push.
///
/// The notice holds no text of its own but [name] (the report's subject or
/// the rated item's name, which the rules check), its id is fixed so it is
/// sent once, and it is best effort: a refusal (an older rules version, a
/// second try) never undoes the report or the rating.
Future<void> notifyPlatformAdmins({
  required FirebaseFirestore firestore,
  required PushRelay pushRelay,
  required PlatformNoticeType type,
  required String subjectId,
  required String senderId,
  required String name,
}) async {
  final id = '${subjectId}_${type.value}';
  try {
    await firestore.collection('notifications').doc(id).set({
      'id': id,
      'recipientType': 'platform_admin',
      'recipientId': 'platform',
      type.subjectKey: subjectId,
      'type': type.value,
      'productName': name,
      'isRead': false,
      'createdAt': FieldValue.serverTimestamp(),
      'senderId': senderId,
    });
  } catch (_) {
    return;
  }
  unawaited(pushRelay.notification(id));
}
