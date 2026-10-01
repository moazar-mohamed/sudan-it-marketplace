import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/error_messages.dart';
import '../../../core/localization/locale_controller.dart';
import '../../chats/presentation/chat_providers.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../../notifications/domain/entities/app_notification.dart';
import '../../notifications/presentation/notification_events.dart';
import '../../notifications/presentation/notifications_providers.dart';
import '../../orders/domain/entities/order_entity.dart';
import '../../service_requests/domain/entities/service_request.dart';
import '../data/firestore_reviews_repository.dart';
import '../domain/review.dart';
import '../domain/reviews_repository.dart';

final reviewsRepositoryProvider = Provider<ReviewsRepository>((ref) {
  return FirestoreReviewsRepository();
});

/// Every running average, keyed as in [RatingStats.keyFor]. One small
/// collection, watched once for every card that shows stars.
final ratingsProvider = StreamProvider<Map<String, RatingStats>>((ref) {
  return ref.watch(reviewsRepositoryProvider).watchRatings();
});

/// The average under [key], or null while loading or when nobody rated yet.
final ratingStatsProvider = Provider.family<RatingStats?, String>((ref, key) {
  final stats = ref.watch(ratingsProvider).asData?.value[key];
  return stats != null && stats.hasRatings ? stats : null;
});

/// The review of one order or service request (null until rated).
final reviewProvider = StreamProvider.family<Review?, String>((ref, id) {
  return ref.watch(reviewsRepositoryProvider).watchReview(id);
});

/// Visible reviews of one product or company service.
final targetReviewsProvider =
    StreamProvider.family<List<Review>, String>((ref, targetId) {
  return ref.watch(reviewsRepositoryProvider).watchTargetReviews(targetId);
});

/// Visible reviews of one company, as customers see them.
final companyPublicReviewsProvider =
    StreamProvider.family<List<Review>, String>((ref, companyId) {
  return ref
      .watch(reviewsRepositoryProvider)
      .watchCompanyPublicReviews(companyId);
});

/// Every review of the company, hidden ones too, for its admins.
final companyReviewsProvider =
    StreamProvider.family<List<Review>, String>((ref, companyId) {
  return ref.watch(reviewsRepositoryProvider).watchCompanyReviews(companyId);
});

/// The signed-in customer's full name; reviews show only part of it.
final reviewerFullNameProvider = Provider<String>((ref) {
  return ref.watch(profileControllerProvider).asData?.value?.fullName ?? '';
});

final reviewActionsProvider = Provider<ReviewActions>((ref) {
  return ReviewActions(ref);
});

/// What an order or service request needs to be rated.
class ReviewSubject {
  const ReviewSubject({
    required this.id,
    required this.source,
    required this.companyId,
    required this.companyName,
    required this.targetId,
    required this.targetName,
  });

  /// A product order; rated once it is completed.
  factory ReviewSubject.order(OrderEntity order) => ReviewSubject(
        id: order.id,
        source: ReviewSource.order,
        companyId: order.companyId,
        companyName: order.companyName,
        targetId: order.productId,
        targetName: order.productName,
      );

  /// A service request; rated once it is completed.
  factory ReviewSubject.serviceRequest(ServiceRequest request) =>
      ReviewSubject(
        id: request.id,
        source: ReviewSource.serviceRequest,
        companyId: request.companyId,
        companyName: request.companyName,
        targetId: request.companyServiceId,
        targetName: request.serviceName,
      );

  /// The order or request id (also the review id).
  final String id;
  final ReviewSource source;
  final String companyId;
  final String companyName;
  final String targetId;
  final String targetName;
}

/// Writes made from the rating screens. Each returns null on success,
/// otherwise a message in the user's language.
class ReviewActions {
  ReviewActions(this._ref);

  final Ref _ref;

  Future<String?> rate(ReviewSubject subject, ReviewDraft draft) async {
    final customerId = _ref.read(currentUserIdProvider);
    if (customerId == null) {
      return _ref.read(appLocalizationsProvider).errorPermissionDenied;
    }
    final fullName = _ref.read(reviewerFullNameProvider);
    return _guard(() async {
      await _ref.read(reviewsRepositoryProvider).createReview(
            Review(
              id: subject.id,
              source: subject.source,
              customerId: customerId,
              authorName: reviewAuthorName(fullName),
              companyId: subject.companyId,
              companyName: subject.companyName,
              targetId: subject.targetId,
              targetName: subject.targetName,
              stars: draft.stars,
              tags: draft.tags,
              comment: draft.comment.trim(),
              createdAt: DateTime.now(),
            ),
          );
      if (subject.source == ReviewSource.order) {
        await _notify(
          NotificationEvents.newReview(
            orderId: subject.id,
            companyId: subject.companyId,
            productName: subject.targetName,
          ),
        );
      }
    });
  }

  Future<String?> edit(Review review, ReviewDraft draft) {
    return _guard(
      () => _ref.read(reviewsRepositoryProvider).editReview(
            review,
            ReviewDraft(
              stars: draft.stars,
              tags: draft.tags,
              comment: draft.comment.trim(),
            ),
          ),
    );
  }

  Future<String?> reply(Review review, String reply) {
    final firstReply = !review.hasReply;
    return _guard(() async {
      await _ref
          .read(reviewsRepositoryProvider)
          .replyToReview(review.id, reply.trim());
      if (firstReply && review.source == ReviewSource.order) {
        await _notify(
          NotificationEvents.reviewReply(
            orderId: review.id,
            customerId: review.customerId,
            productName: review.targetName,
          ),
        );
      }
    });
  }

  Future<String?> _guard(Future<void> Function() action) async {
    try {
      await action();
      return null;
    } catch (error) {
      return localizedErrorMessage(_ref.read(appLocalizationsProvider), error);
    }
  }

  /// A notification that fails to send never undoes the rating itself.
  Future<void> _notify(AppNotification notification) async {
    try {
      await _ref
          .read(notificationsRepositoryProvider)
          .createNotification(notification);
    } catch (_) {}
  }
}
