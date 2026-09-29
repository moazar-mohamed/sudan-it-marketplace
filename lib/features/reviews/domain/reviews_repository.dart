import 'review.dart';

/// What the customer fills in on the rating sheet.
class ReviewDraft {
  const ReviewDraft({
    required this.stars,
    this.tags = const [],
    this.comment = '',
  });

  final int stars;
  final List<ReviewTag> tags;
  final String comment;
}

abstract class ReviewsRepository {
  /// Every running average, keyed as in [RatingStats.keyFor].
  Stream<Map<String, RatingStats>> watchRatings();

  /// The review of one order or service request (null until it is rated).
  Stream<Review?> watchReview(String reviewId);

  /// Visible reviews of one product or company service, newest first.
  Stream<List<Review>> watchTargetReviews(String targetId);

  /// Visible reviews of one company, newest first.
  Stream<List<Review>> watchCompanyPublicReviews(String companyId);

  /// Every review of one company, hidden ones too (its admins only).
  Stream<List<Review>> watchCompanyReviews(String companyId);

  /// Rates a completed order or request and moves both averages with it.
  Future<void> createReview(Review review);

  /// Changes the customer's own review; moves the averages when the stars
  /// change.
  Future<void> editReview(Review review, ReviewDraft draft);

  /// The company's one reply (sent again to reword it).
  Future<void> replyToReview(String reviewId, String reply);
}
