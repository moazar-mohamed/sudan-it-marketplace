/// What a review was written about: the product of a completed order, or the
/// company service of a completed service request.
enum ReviewSource {
  order('order', 'product'),
  serviceRequest('service_request', 'service');

  const ReviewSource(this.value, this.targetType);

  final String value;

  /// The kind of thing rated, as it appears in `ratings/` keys.
  final String targetType;

  static ReviewSource fromValue(String? value) =>
      value == serviceRequest.value ? serviceRequest : order;
}

/// Quick reasons a customer can tick; stored by [value].
enum ReviewTag {
  quality('quality'),
  delivery('delivery'),
  punctual('punctual'),
  service('service'),
  price('price');

  const ReviewTag(this.value);

  final String value;

  /// The tags offered for [source]: products are delivered, services are
  /// done on time.
  static List<ReviewTag> forSource(ReviewSource source) => switch (source) {
        ReviewSource.order => const [quality, delivery, service, price],
        ReviewSource.serviceRequest => const [quality, punctual, service, price],
      };

  static List<ReviewTag> parse(Object? raw) => [
        if (raw is List)
          for (final value in raw)
            for (final tag in values)
              if (tag.value == value) tag,
      ];
}

/// One customer's rating of one completed order or service request. Its id
/// is the order's or request's id, so each can be rated only once. The same
/// stars count for the product / service and for the company.
class Review {
  const Review({
    required this.id,
    required this.source,
    required this.customerId,
    required this.authorName,
    required this.companyId,
    required this.companyName,
    required this.targetId,
    required this.targetName,
    required this.stars,
    this.tags = const [],
    this.comment = '',
    this.hidden = false,
    this.reply,
    this.replyAt,
    required this.createdAt,
    this.updatedAt,
  });

  /// How long after rating the customer may still change it (kept in step
  /// with reviewEditWindowOpen in firestore.rules).
  static const editWindow = Duration(days: 7);

  static const maxCommentLength = 500;
  static const maxReplyLength = 500;

  final String id;
  final ReviewSource source;
  final String customerId;

  /// The customer's first name and initial, as shown to everyone.
  final String authorName;
  final String companyId;
  final String companyName;

  /// The product id, or the company service (link) id.
  final String targetId;
  final String targetName;
  final int stars;
  final List<ReviewTag> tags;
  final String comment;

  /// Hidden by Platform Admin: out of the averages and of public lists.
  final bool hidden;
  final String? reply;
  final DateTime? replyAt;
  final DateTime createdAt;
  final DateTime? updatedAt;

  bool get hasReply => (reply ?? '').trim().isNotEmpty;

  /// Whether its customer may still change it at [now].
  bool canEditAt(DateTime now) =>
      !hidden && now.isBefore(createdAt.add(editWindow));

  /// The `ratings/` key of what was rated.
  String get targetRatingsKey => RatingStats.keyFor(source.targetType, targetId);

  String get companyRatingsKey => RatingStats.companyKey(companyId);
}

/// A running average: the sum of the stars and how many ratings there are.
class RatingStats {
  const RatingStats({required this.sum, required this.count});

  static const empty = RatingStats(sum: 0, count: 0);

  final int sum;
  final int count;

  bool get hasRatings => count > 0;

  double get average => count == 0 ? 0 : sum / count;

  static String keyFor(String targetType, String id) => '${targetType}_$id';
  static String companyKey(String companyId) => keyFor('company', companyId);
  static String productKey(String productId) => keyFor('product', productId);
  static String serviceKey(String companyServiceId) =>
      keyFor('service', companyServiceId);
}

/// "Ahmed Mohamed Ali" → "Ahmed M." so reviews never show a full name.
String reviewAuthorName(String fullName) {
  final parts = fullName.trim().split(RegExp(r'\s+'))
    ..removeWhere((part) => part.isEmpty);
  if (parts.isEmpty) return '';
  final first = parts.first;
  final shown = parts.length > 1
      ? '$first ${String.fromCharCode(parts[1].runes.first)}.'
      : first;
  return shown.length > 60 ? shown.substring(0, 60) : shown;
}
