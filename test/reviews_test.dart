import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/features/chats/presentation/chat_providers.dart';
import 'package:sudan_it_marketplace/features/company_admin/presentation/reviews/company_reviews_screen.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/review.dart';
import 'package:sudan_it_marketplace/features/reviews/domain/reviews_repository.dart';
import 'package:sudan_it_marketplace/features/reviews/presentation/review_widgets.dart';
import 'package:sudan_it_marketplace/features/reviews/presentation/reviews_providers.dart';
import 'package:sudan_it_marketplace/l10n/app_localizations.dart';

const _en = Locale('en');
const _ar = Locale('ar');

/// Keeps reviews in memory and records what the screens asked for.
class _FakeReviews implements ReviewsRepository {
  _FakeReviews({Map<String, RatingStats>? ratings, List<Review>? reviews})
      : ratings = ratings ?? {},
        reviews = {for (final r in reviews ?? <Review>[]) r.id: r};

  final Map<String, RatingStats> ratings;
  final Map<String, Review> reviews;
  final created = <Review>[];
  final edits = <ReviewDraft>[];
  final replies = <String, String>{};
  final _changes = StreamController<void>.broadcast();

  Stream<T> _live<T>(T Function() read) async* {
    yield read();
    yield* _changes.stream.map((_) => read());
  }

  @override
  Stream<Map<String, RatingStats>> watchRatings() => _live(() => ratings);

  @override
  Stream<Review?> watchReview(String reviewId) => _live(() => reviews[reviewId]);

  @override
  Stream<List<Review>> watchTargetReviews(String targetId) => _live(
        () => [
          for (final r in reviews.values)
            if (r.targetId == targetId && !r.hidden) r,
        ],
      );

  @override
  Stream<List<Review>> watchCompanyPublicReviews(String companyId) => _live(
        () => [
          for (final r in reviews.values)
            if (r.companyId == companyId && !r.hidden) r,
        ],
      );

  @override
  Stream<List<Review>> watchCompanyReviews(String companyId) => _live(
        () => [
          for (final r in reviews.values)
            if (r.companyId == companyId) r,
        ],
      );

  @override
  Future<void> createReview(Review review) async {
    created.add(review);
    reviews[review.id] = review;
    _changes.add(null);
  }

  @override
  Future<void> editReview(Review review, ReviewDraft draft) async {
    edits.add(draft);
  }

  @override
  Future<void> replyToReview(String reviewId, String reply) async {
    replies[reviewId] = reply;
  }
}

const _subject = ReviewSubject(
  id: 'o1',
  source: ReviewSource.order,
  companyId: 'c1',
  companyName: 'Nile Tech',
  targetId: 'p1',
  targetName: 'Lenovo',
);

Review _review({
  String id = 'o1',
  int stars = 4,
  DateTime? createdAt,
  bool hidden = false,
  String? reply,
  List<ReviewTag> tags = const [ReviewTag.quality],
}) =>
    Review(
      id: id,
      source: ReviewSource.order,
      customerId: 'cust1',
      authorName: 'Ahmed M.',
      companyId: 'c1',
      companyName: 'Nile Tech',
      targetId: 'p1',
      targetName: 'Lenovo',
      stars: stars,
      tags: tags,
      comment: 'Fast and well packed',
      hidden: hidden,
      reply: reply,
      createdAt: createdAt ?? DateTime.now(),
    );

Widget _app(Widget home, _FakeReviews fake, {Locale locale = _en}) {
  return ProviderScope(
    overrides: [
      reviewsRepositoryProvider.overrideWithValue(fake),
      currentUserIdProvider.overrideWithValue('cust1'),
      reviewerFullNameProvider.overrideWithValue('Ahmed Mohamed Ali'),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [_en, _ar],
      home: Scaffold(body: SingleChildScrollView(child: home)),
    ),
  );
}

void main() {
  group('review basics', () {
    test('shows only the first name and an initial', () {
      expect(reviewAuthorName('Ahmed Mohamed Ali'), 'Ahmed M.');
      expect(reviewAuthorName('  محمد   أحمد '), 'محمد أ.');
      expect(reviewAuthorName('Sara'), 'Sara');
      expect(reviewAuthorName('   '), '');
    });

    test('can be changed for seven days, and never once hidden', () {
      final review = _review(createdAt: DateTime(2026, 9, 1));
      expect(review.canEditAt(DateTime(2026, 9, 7)), isTrue);
      expect(review.canEditAt(DateTime(2026, 9, 9)), isFalse);
      expect(
        _review(createdAt: DateTime(2026, 9, 1), hidden: true)
            .canEditAt(DateTime(2026, 9, 2)),
        isFalse,
      );
    });

    test('averages and ratings keys', () {
      expect(const RatingStats(sum: 9, count: 2).average, 4.5);
      expect(RatingStats.empty.average, 0);
      expect(_review().companyRatingsKey, 'company_c1');
      expect(_review().targetRatingsKey, 'product_p1');
      expect(RatingStats.serviceKey('c1_svc1'), 'service_c1_svc1');
    });

    test('tags are offered per kind and unknown ones are dropped', () {
      expect(ReviewTag.forSource(ReviewSource.order), contains(ReviewTag.delivery));
      expect(
        ReviewTag.forSource(ReviewSource.serviceRequest),
        contains(ReviewTag.punctual),
      );
      expect(ReviewTag.parse(['price', 'cheap']), [ReviewTag.price]);
    });
  });

  group('rating line', () {
    testWidgets('says New until someone rates', (tester) async {
      await tester.pumpWidget(
        _app(const RatingLine(ratingsKey: 'company_c1'), _FakeReviews()),
      );
      await tester.pumpAndSettle();
      expect(find.text('New'), findsOneWidget);
    });

    testWidgets('shows the running average and count', (tester) async {
      final fake = _FakeReviews(
        ratings: {'company_c1': const RatingStats(sum: 23, count: 5)},
      );
      await tester.pumpWidget(
        _app(const RatingLine(ratingsKey: 'company_c1'), fake),
      );
      await tester.pumpAndSettle();
      expect(find.text('4.6'), findsOneWidget);
      expect(find.text('(5 reviews)'), findsOneWidget);
    });

    testWidgets('keeps a demo company its own numbers', (tester) async {
      await tester.pumpWidget(
        _app(
          const RatingLine(
            ratingsKey: 'company_demo',
            fallbackAverage: 4.9,
            fallbackCount: 54,
          ),
          _FakeReviews(),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('4.9'), findsOneWidget);
    });

    testWidgets('can stay empty in busy lists', (tester) async {
      await tester.pumpWidget(
        _app(
          const RatingLine(ratingsKey: 'product_p1', showNew: false),
          _FakeReviews(),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('New'), findsNothing);
    });
  });

  group('customer rates a completed order', () {
    testWidgets('asks, then saves stars, tags and comment', (tester) async {
      final fake = _FakeReviews();
      await tester.pumpWidget(
        _app(const SubjectReviewCard(subject: _subject, asCompany: false), fake),
      );
      await tester.pumpAndSettle();
      expect(find.text('How was your experience?'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('review-rate')));
      await tester.pumpAndSettle();

      // Sending without stars asks for them.
      await tester.tap(find.byKey(const ValueKey('review-submit')));
      await tester.pumpAndSettle();
      expect(find.text('Choose the stars first.'), findsOneWidget);
      expect(fake.created, isEmpty);

      await tester.tap(find.byKey(const ValueKey('review-star-4')).last);
      await tester.pumpAndSettle();
      expect(find.text('Very good'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('review-tag-delivery')));
      await tester.enterText(
        find.descendant(
          of: find.byKey(const ValueKey('review-comment')),
          matching: find.byType(EditableText),
        ),
        '  Arrived next day  ',
      );
      await tester.ensureVisible(find.byKey(const ValueKey('review-submit')));
      await tester.tap(find.byKey(const ValueKey('review-submit')));
      await tester.pumpAndSettle();

      expect(fake.created, hasLength(1));
      final saved = fake.created.single;
      expect(saved.id, 'o1');
      expect(saved.stars, 4);
      expect(saved.tags, [ReviewTag.delivery]);
      expect(saved.comment, 'Arrived next day');
      expect(saved.authorName, 'Ahmed M.');
      expect(saved.customerId, 'cust1');
      expect(saved.targetId, 'p1');
      expect(saved.companyId, 'c1');

      // The card now shows the customer's own rating with an edit button.
      expect(find.text('Your rating'), findsOneWidget);
      expect(find.byKey(const ValueKey('review-edit')), findsOneWidget);
    });

    testWidgets('tapping a star on the card opens the sheet with it picked',
        (tester) async {
      final fake = _FakeReviews();
      await tester.pumpWidget(
        _app(const SubjectReviewCard(subject: _subject, asCompany: false), fake),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('review-star-5')));
      await tester.pumpAndSettle();
      expect(find.text('Excellent'), findsOneWidget);
    });

    testWidgets('an old rating can no longer be edited', (tester) async {
      final fake = _FakeReviews(
        reviews: [
          _review(createdAt: DateTime.now().subtract(const Duration(days: 8))),
        ],
      );
      await tester.pumpWidget(
        _app(const SubjectReviewCard(subject: _subject, asCompany: false), fake),
      );
      await tester.pumpAndSettle();
      expect(find.text('Your rating'), findsOneWidget);
      expect(find.byKey(const ValueKey('review-edit')), findsNothing);
    });

    testWidgets('editing sends the new stars', (tester) async {
      final fake = _FakeReviews(reviews: [_review(stars: 2)]);
      await tester.pumpWidget(
        _app(const SubjectReviewCard(subject: _subject, asCompany: false), fake),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('review-edit')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('review-star-5')).last);
      await tester.ensureVisible(find.byKey(const ValueKey('review-submit')));
      await tester.tap(find.byKey(const ValueKey('review-submit')));
      await tester.pumpAndSettle();
      expect(fake.edits.single.stars, 5);
    });
  });

  group('company side', () {
    testWidgets('sees nothing before the customer rates', (tester) async {
      await tester.pumpWidget(
        _app(
          const SubjectReviewCard(subject: _subject, asCompany: true),
          _FakeReviews(),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('How was your experience?'), findsNothing);
      expect(find.byKey(const ValueKey('review-reply')), findsNothing);
    });

    testWidgets('replies to a rating', (tester) async {
      final fake = _FakeReviews(reviews: [_review()]);
      await tester.pumpWidget(
        _app(const SubjectReviewCard(subject: _subject, asCompany: true), fake),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('review-reply')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('review-reply-send')));
      await tester.pumpAndSettle();
      expect(find.text('Write a reply first.'), findsOneWidget);

      await tester.enterText(
        find.descendant(
          of: find.byKey(const ValueKey('review-reply-text')),
          matching: find.byType(EditableText),
        ),
        'Thank you!',
      );
      await tester.tap(find.byKey(const ValueKey('review-reply-send')));
      await tester.pumpAndSettle();
      expect(fake.replies, {'o1': 'Thank you!'});
    });

    testWidgets('lists every rating, marks hidden ones and shows replies',
        (tester) async {
      final fake = _FakeReviews(
        reviews: [
          _review(reply: 'Thanks for your order'),
          _review(id: 'o2', stars: 1, hidden: true, tags: const []),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [reviewsRepositoryProvider.overrideWithValue(fake)],
          child: MaterialApp(
            locale: _ar,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: const [_en, _ar],
            home: const CompanyReviewsScreen(companyId: 'c1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('company-review-o1')), findsOneWidget);
      expect(find.byKey(const ValueKey('company-review-o2')), findsOneWidget);
      expect(find.text('أخفته إدارة المنصة'), findsOneWidget);
      expect(find.text('Thanks for your order'), findsOneWidget);
      expect(find.text('تعديل الرد'), findsOneWidget);
    });
  });

  testWidgets('product page section: summary and newest reviews', (tester) async {
    final fake = _FakeReviews(
      reviews: [
        _review(stars: 5),
        _review(id: 'o2', stars: 3),
        _review(id: 'o3', stars: 1, hidden: true),
      ],
    );
    await tester.pumpWidget(
      _app(ReviewsSection(provider: targetReviewsProvider('p1')), fake),
    );
    await tester.pumpAndSettle();
    expect(find.text('Ratings'), findsOneWidget);
    // Hidden reviews are left out: (5 + 3) / 2.
    expect(find.text('4.0'), findsOneWidget);
    expect(find.text('2 ratings'), findsOneWidget);
  });
}
