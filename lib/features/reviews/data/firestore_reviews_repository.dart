import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../core/errors/app_exception.dart';
import '../domain/review.dart';
import '../domain/reviews_repository.dart';

/// Reviews in `reviews/{orderOrRequestId}` and their running averages in
/// `ratings/{key}`. There is no server: each batch that changes a review's
/// stars moves the averages too, and firestore.rules checks both match.
class FirestoreReviewsRepository implements ReviewsRepository {
  FirestoreReviewsRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _reviews =>
      _firestore.collection('reviews');

  CollectionReference<Map<String, dynamic>> get _ratings =>
      _firestore.collection('ratings');

  @override
  Stream<Map<String, RatingStats>> watchRatings() {
    return _ratings.snapshots().map((snapshot) {
      return {
        for (final doc in snapshot.docs)
          doc.id: RatingStats(
            sum: (doc.data()['sum'] as num?)?.toInt() ?? 0,
            count: (doc.data()['count'] as num?)?.toInt() ?? 0,
          ),
      };
    }).handleError(_throwLoadError);
  }

  @override
  Stream<Review?> watchReview(String reviewId) {
    return _reviews
        .doc(reviewId)
        .snapshots()
        .map((doc) => doc.exists ? reviewFromMap(doc.id, doc.data()!) : null)
        .handleError(_throwLoadError);
  }

  @override
  Stream<List<Review>> watchTargetReviews(String targetId) => _watchList(
        _reviews
            .where('targetId', isEqualTo: targetId)
            .where('hidden', isEqualTo: false),
      );

  @override
  Stream<List<Review>> watchCompanyPublicReviews(String companyId) =>
      _watchList(
        _reviews
            .where('companyId', isEqualTo: companyId)
            .where('hidden', isEqualTo: false),
      );

  @override
  Stream<List<Review>> watchCompanyReviews(String companyId) =>
      _watchList(_reviews.where('companyId', isEqualTo: companyId));

  /// Sorted here (newest first) so no composite index is needed.
  Stream<List<Review>> _watchList(Query<Map<String, dynamic>> query) {
    return query.snapshots().map((snapshot) {
      return [
        for (final doc in snapshot.docs) reviewFromMap(doc.id, doc.data()),
      ]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    }).handleError(_throwLoadError);
  }

  @override
  Future<void> createReview(Review review) async {
    final batch = _firestore.batch();
    batch.set(_reviews.doc(review.id), {
      'id': review.id,
      'sourceType': review.source.value,
      'customerId': review.customerId,
      'authorName': review.authorName,
      'companyId': review.companyId,
      'companyName': review.companyName,
      'targetType': review.source.targetType,
      'targetId': review.targetId,
      'targetName': review.targetName,
      'stars': review.stars,
      'tags': [for (final tag in review.tags) tag.value],
      'comment': review.comment,
      'hidden': false,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    _moveRatings(batch, review, starsBy: review.stars, countBy: 1);
    await _commit(batch);
  }

  @override
  Future<void> editReview(Review review, ReviewDraft draft) async {
    final batch = _firestore.batch();
    batch.update(_reviews.doc(review.id), {
      'stars': draft.stars,
      'tags': [for (final tag in draft.tags) tag.value],
      'comment': draft.comment,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    final delta = draft.stars - review.stars;
    if (delta != 0) _moveRatings(batch, review, starsBy: delta);
    await _commit(batch);
  }

  @override
  Future<void> replyToReview(String reviewId, String reply) async {
    try {
      await _reviews.doc(reviewId).update({
        'reply': reply,
        'replyAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (error) {
      throw AppException(
        AppErrorCode.reviewReplyFailed,
        detail: error.code,
        reason: error.code,
      );
    }
  }

  /// Moves the company's and the product's / service's averages, naming the
  /// review that explains the change.
  void _moveRatings(
    WriteBatch batch,
    Review review, {
    required int starsBy,
    int countBy = 0,
  }) {
    for (final key in [review.companyRatingsKey, review.targetRatingsKey]) {
      batch.set(
        _ratings.doc(key),
        {
          'companyId': review.companyId,
          'sum': FieldValue.increment(starsBy),
          if (countBy != 0) 'count': FieldValue.increment(countBy),
          'lastReviewId': review.id,
          'updatedAt': FieldValue.serverTimestamp(),
        },
        SetOptions(merge: true),
      );
    }
  }

  Future<void> _commit(WriteBatch batch) async {
    try {
      await batch.commit();
    } on FirebaseException catch (error) {
      throw AppException(
        error.code == 'permission-denied'
            ? AppErrorCode.reviewSaveDenied
            : AppErrorCode.reviewSaveFailed,
        detail: error.code,
        reason: error.code,
      );
    }
  }

  static Never _throwLoadError(Object error, StackTrace stackTrace) {
    throw AppException(
      AppErrorCode.reviewLoadFailed,
      detail: error is FirebaseException ? error.code : '$error',
    );
  }
}

Review reviewFromMap(String id, Map<String, dynamic> data) {
  DateTime? time(Object? value) => switch (value) {
        Timestamp() => value.toDate(),
        DateTime() => value,
        _ => null,
      };
  return Review(
    id: id,
    source: ReviewSource.fromValue(data['sourceType'] as String?),
    customerId: data['customerId'] as String? ?? '',
    authorName: data['authorName'] as String? ?? '',
    companyId: data['companyId'] as String? ?? '',
    companyName: data['companyName'] as String? ?? '',
    targetId: data['targetId'] as String? ?? '',
    targetName: data['targetName'] as String? ?? '',
    stars: ((data['stars'] as num?)?.toInt() ?? 0).clamp(0, 5),
    tags: ReviewTag.parse(data['tags']),
    comment: data['comment'] as String? ?? '',
    hidden: data['hidden'] == true,
    reply: data['reply'] as String?,
    replyAt: time(data['replyAt']),
    // A review just written reads back without its server time for a moment.
    createdAt: time(data['createdAt']) ?? DateTime.now(),
    updatedAt: time(data['updatedAt']),
  );
}
