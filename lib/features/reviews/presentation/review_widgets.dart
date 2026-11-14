import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/review.dart';
import '../domain/reviews_repository.dart';
import 'reviews_providers.dart';

String reviewStarsLabel(AppLocalizations l10n, int stars) => switch (stars) {
      1 => l10n.reviewStars1,
      2 => l10n.reviewStars2,
      3 => l10n.reviewStars3,
      4 => l10n.reviewStars4,
      _ => l10n.reviewStars5,
    };

String reviewTagLabel(AppLocalizations l10n, ReviewTag tag) => switch (tag) {
      ReviewTag.quality => l10n.reviewTagQuality,
      ReviewTag.delivery => l10n.reviewTagDelivery,
      ReviewTag.punctual => l10n.reviewTagPunctual,
      ReviewTag.service => l10n.reviewTagService,
      ReviewTag.price => l10n.reviewTagPrice,
    };

String formatReviewDate(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${local.year}-${two(local.month)}-${two(local.day)}';
}

/// Five stars, the first [stars] of them filled.
class StarRow extends StatelessWidget {
  const StarRow({super.key, required this.stars, this.size = AppSize.iconSm});

  final num stars;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      label: context.l10n.reviewStarsSemantics(stars.round()),
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 1; i <= 5; i++)
            Icon(
              stars >= i
                  ? Icons.star_rounded
                  : stars >= i - 0.5
                      ? Icons.star_half_rounded
                      : Icons.star_outline_rounded,
              size: size,
              color: stars >= i - 0.5 ? colors.warning : colors.iconMuted,
            ),
        ],
      ),
    );
  }
}

/// "★ 4.6 (12 reviews)" for the average under [ratingsKey], or a «New»
/// label when nobody rated it yet. Demo companies that are not in Firestore
/// pass their own numbers as [fallbackAverage] / [fallbackCount].
class RatingLine extends ConsumerWidget {
  const RatingLine({
    super.key,
    required this.ratingsKey,
    this.fallbackAverage = 0,
    this.fallbackCount = 0,
    this.showCount = true,
    this.showNew = true,
  });

  final String ratingsKey;
  final double fallbackAverage;
  final int fallbackCount;
  final bool showCount;

  /// False: nothing at all until someone rates (busy lists).
  final bool showNew;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final stats = ref.watch(ratingStatsProvider(ratingsKey));
    final average = stats?.average ?? fallbackAverage;
    final count = stats?.count ?? fallbackCount;
    if (count == 0) {
      if (!showNew) return const SizedBox.shrink();
      return Text(
        context.l10n.reviewsNew,
        style: AppTextStyles.captionStrong.copyWith(color: colors.textBrand),
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.star_rounded, color: colors.warning, size: AppSize.iconMd),
        const SizedBox(width: AppSpacing.s4),
        Text(average.toStringAsFixed(1), style: AppTextStyles.captionStrong),
        if (showCount) ...[
          const SizedBox(width: AppSpacing.s6),
          Flexible(
            child: Text(
              context.l10n.reviewsCount(count),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
            ),
          ),
        ],
      ],
    );
  }
}

/// One review: who, stars, when, tags, comment, and the company's reply.
class ReviewTile extends StatelessWidget {
  const ReviewTile({
    super.key,
    required this.review,
    this.showTarget = false,
    this.footer,
  });

  final Review review;

  /// Also names what was rated (on the company's list).
  final bool showTarget;

  /// Actions under the review (edit, reply).
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final name = review.authorName.trim().isEmpty
        ? l10n.reviewAnonymous
        : review.authorName;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: colors.brandPrimarySubtle,
              child: Text(
                String.fromCharCode(name.runes.first),
                style: AppTextStyles.bodyStrong.copyWith(color: colors.textBrand),
              ),
            ),
            const SizedBox(width: AppSpacing.s8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: AppTextStyles.bodyStrong),
                  Row(
                    children: [
                      Icon(
                        Icons.verified_outlined,
                        size: 14,
                        color: colors.successText,
                      ),
                      const SizedBox(width: AppSpacing.s2),
                      Flexible(
                        child: Text(
                          l10n.reviewVerified,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption
                              .copyWith(color: colors.successText),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                StarRow(stars: review.stars),
                Text(
                  formatReviewDate(review.createdAt),
                  textDirection: TextDirection.ltr,
                  style: AppTextStyles.caption.copyWith(color: colors.textTertiary),
                ),
              ],
            ),
          ],
        ),
        if (review.hidden) ...[
          const SizedBox(height: AppSpacing.s8),
          StatusChip(label: l10n.reviewHiddenByAdmin, tone: AppTone.warning),
        ],
        if (showTarget) ...[
          const SizedBox(height: AppSpacing.s6),
          Text(
            review.targetName,
            style: AppTextStyles.captionStrong.copyWith(color: colors.textBrand),
          ),
        ],
        if (review.tags.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s8),
          Wrap(
            spacing: AppSpacing.s6,
            runSpacing: AppSpacing.s6,
            children: [
              for (final tag in review.tags)
                StatusChip(
                  label: reviewTagLabel(l10n, tag),
                  tone: AppTone.success,
                  showDot: false,
                ),
            ],
          ),
        ],
        if (review.comment.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s8),
          Text(review.comment, style: AppTextStyles.body),
        ],
        if (review.hasReply) ...[
          const SizedBox(height: AppSpacing.s8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.s12),
            decoration: BoxDecoration(
              color: colors.bgSubtle,
              borderRadius: AppRadius.smAll,
              border: BorderDirectional(
                start: BorderSide(color: colors.brandPrimary, width: 3),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${l10n.reviewCompanyReply} · ${review.companyName}',
                  style: AppTextStyles.captionStrong,
                ),
                const SizedBox(height: AppSpacing.s4),
                Text(review.reply!, style: AppTextStyles.body),
              ],
            ),
          ),
        ],
        if (footer != null) ...[
          const SizedBox(height: AppSpacing.s8),
          footer!,
        ],
      ],
    );
  }
}

/// Average, stars and how the ratings spread over 1-5, from [reviews].
class RatingSummary extends StatelessWidget {
  const RatingSummary({super.key, required this.reviews});

  final List<Review> reviews;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final count = reviews.length;
    final average = count == 0
        ? 0.0
        : reviews.fold<int>(0, (sum, r) => sum + r.stars) / count;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Column(
          children: [
            Text(average.toStringAsFixed(1), style: AppTextStyles.stat),
            StarRow(stars: average),
            const SizedBox(height: AppSpacing.s2),
            Text(
              context.l10n.reviewsBasedOn(count),
              style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
            ),
          ],
        ),
        const SizedBox(width: AppSpacing.s16),
        Expanded(
          child: Column(
            children: [
              for (var stars = 5; stars >= 1; stars--)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 14,
                        child: Text('$stars', style: AppTextStyles.caption),
                      ),
                      Icon(Icons.star_rounded, size: 12, color: colors.warning),
                      const SizedBox(width: AppSpacing.s6),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: AppRadius.fullAll,
                          child: LinearProgressIndicator(
                            value: count == 0
                                ? 0
                                : reviews.where((r) => r.stars == stars).length /
                                    count,
                            minHeight: 6,
                            backgroundColor: colors.bgMuted,
                            color: colors.warning,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The ratings block on a product, service or company page: summary, the
/// newest reviews and a way to see them all. Shows nothing until someone
/// rated.
class ReviewsSection extends ConsumerWidget {
  const ReviewsSection({
    super.key,
    required this.provider,
    this.preview = 3,
    this.padding = EdgeInsets.zero,
  });

  /// [targetReviewsProvider] or [companyPublicReviewsProvider] for one id.
  final StreamProvider<List<Review>> provider;
  final int preview;

  /// Space around the section, only when it shows.
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviews = ref.watch(provider).asData?.value ?? const <Review>[];
    if (reviews.isEmpty) return const SizedBox.shrink();
    return Padding(padding: padding, child: _section(context, reviews));
  }

  Widget _section(BuildContext context, List<Review> reviews) {
    final l10n = context.l10n;
    return SectionCard(
      title: l10n.reviewsTitle,
      children: [
        RatingSummary(reviews: reviews),
        for (final review in reviews.take(preview)) ...[
          const Divider(height: AppSpacing.s24),
          ReviewTile(review: review),
        ],
        if (reviews.length > preview) ...[
          const SizedBox(height: AppSpacing.s8),
          AppButton.text(
            label: l10n.reviewsSeeAll(reviews.length),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => ReviewsListScreen(provider: provider),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Every visible review of one product, service or company.
class ReviewsListScreen extends ConsumerWidget {
  const ReviewsListScreen({super.key, required this.provider});

  final StreamProvider<List<Review>> provider;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviews = ref.watch(provider).asData?.value ?? const <Review>[];
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.reviewsTitle)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
        children: [
          RatingSummary(reviews: reviews),
          for (final review in reviews) ...[
            const Divider(height: AppSpacing.s32),
            ReviewTile(review: review),
          ],
        ],
      ),
    );
  }
}

/// The rating of one order or service request, on its details screen. The
/// customer is asked to rate once it is completed, then sees (and for a
/// while can change) their rating; the company sees it and replies.
class SubjectReviewCard extends ConsumerWidget {
  const SubjectReviewCard({
    super.key,
    required this.subject,
    required this.asCompany,
    this.padding = EdgeInsets.zero,
  });

  final ReviewSubject subject;
  final bool asCompany;

  /// Space around the card, only when there is a card to show (the company
  /// sees nothing until the customer rates).
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final card = _card(context, ref);
    if (card == null) return const SizedBox.shrink();
    return Padding(padding: padding, child: card);
  }

  Widget? _card(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final colors = context.colors;
    final review = ref.watch(reviewProvider(subject.id)).asData?.value;
    if (review == null) {
      if (asCompany) return null;
      return AppCard(
        key: const ValueKey('review-prompt'),
        padding: const EdgeInsets.all(AppSpacing.s16),
        color: colors.brandPrimarySubtle,
        borderColor: colors.borderFocus,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.reviewPromptTitle, style: AppTextStyles.h3),
            const SizedBox(height: AppSpacing.s4),
            Text(
              l10n.reviewPromptBody,
              style: AppTextStyles.body.copyWith(color: colors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.s8),
            _StarPicker(
              stars: 0,
              onChanged: (stars) => showReviewSheet(
                context,
                subject: subject,
                initialStars: stars,
              ),
            ),
            const SizedBox(height: AppSpacing.s8),
            AppButton.primary(
              key: const ValueKey('review-rate'),
              icon: Icons.star_outline_rounded,
              label: l10n.reviewRateAction,
              expand: true,
              onPressed: () => showReviewSheet(context, subject: subject),
            ),
          ],
        ),
      );
    }

    final canEdit = !asCompany && review.canEditAt(DateTime.now());
    return SectionCard(
      title: asCompany ? l10n.reviewsTitle : l10n.reviewYours,
      children: [
        ReviewTile(
          review: review,
          footer: asCompany
              ? Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: AppButton.outlined(
                    key: const ValueKey('review-reply'),
                    icon: Icons.reply_rounded,
                    size: AppButtonSize.medium,
                    label: review.hasReply
                        ? l10n.reviewEditReplyAction
                        : l10n.reviewReplyAction,
                    onPressed: () => showReplySheet(context, review),
                  ),
                )
              : canEdit
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.reviewEditUntil(
                            formatReviewDate(
                              review.createdAt.add(Review.editWindow),
                            ),
                          ),
                          style: AppTextStyles.caption
                              .copyWith(color: colors.textSecondary),
                        ),
                        const SizedBox(height: AppSpacing.s4),
                        AppButton.outlined(
                          key: const ValueKey('review-edit'),
                          icon: Icons.edit_outlined,
                          size: AppButtonSize.medium,
                          label: l10n.reviewEditAction,
                          onPressed: () => showReviewSheet(
                            context,
                            subject: subject,
                            existing: review,
                          ),
                        ),
                      ],
                    )
                  : null,
        ),
      ],
    );
  }
}

/// Tappable stars (1-5) for picking a rating.
class _StarPicker extends StatelessWidget {
  const _StarPicker({required this.stars, required this.onChanged});

  final int stars;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 1; i <= 5; i++)
          IconButton(
            key: ValueKey('review-star-$i'),
            tooltip: context.l10n.reviewStarsSemantics(i),
            iconSize: 36,
            onPressed: () => onChanged(i),
            icon: Icon(
              i <= stars ? Icons.star_rounded : Icons.star_outline_rounded,
              color: i <= stars ? colors.warning : colors.iconMuted,
            ),
          ),
      ],
    );
  }
}

/// Rates [subject], or changes [existing].
Future<void> showReviewSheet(
  BuildContext context, {
  required ReviewSubject subject,
  Review? existing,
  int initialStars = 0,
}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => _ReviewSheet(
      subject: subject,
      existing: existing,
      initialStars: initialStars,
    ),
  );
}

class _ReviewSheet extends ConsumerStatefulWidget {
  const _ReviewSheet({
    required this.subject,
    required this.existing,
    required this.initialStars,
  });

  final ReviewSubject subject;
  final Review? existing;
  final int initialStars;

  @override
  ConsumerState<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends ConsumerState<_ReviewSheet> {
  late int _stars = widget.existing?.stars ?? widget.initialStars;
  late final Set<ReviewTag> _tags = {...?widget.existing?.tags};
  late final _comment = TextEditingController(text: widget.existing?.comment);
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    if (_stars == 0) {
      setState(() => _error = l10n.reviewStarsRequired);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final draft = ReviewDraft(
      stars: _stars,
      tags: [
        for (final tag in ReviewTag.values)
          if (_tags.contains(tag)) tag,
      ],
      comment: _comment.text,
    );
    final actions = ref.read(reviewActionsProvider);
    final existing = widget.existing;
    final error = existing == null
        ? await actions.rate(widget.subject, draft)
        : await actions.edit(existing, draft);
    if (!mounted) return;
    if (error != null) {
      setState(() {
        _saving = false;
        _error = error;
      });
      return;
    }
    Navigator.of(context).pop();
    showAppSnackBar(
      context,
      existing == null ? l10n.reviewThanks : l10n.reviewUpdated,
      tone: AppTone.success,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final subject = widget.subject;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.s16,
          0,
          AppSpacing.s16,
          AppSpacing.s24,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              subject.source == ReviewSource.order
                  ? l10n.reviewRateOrderTitle
                  : l10n.reviewRateServiceTitle,
              style: AppTextStyles.h2,
            ),
            Text(
              '${subject.targetName} · ${subject.companyName}',
              style: AppTextStyles.body.copyWith(color: colors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.s12),
            _StarPicker(
              stars: _stars,
              onChanged: (stars) => setState(() {
                _stars = stars;
                _error = null;
              }),
            ),
            Text(
              _stars == 0 ? l10n.reviewTapStars : reviewStarsLabel(l10n, _stars),
              textAlign: TextAlign.center,
              style: AppTextStyles.bodyStrong.copyWith(
                color: _stars == 0 ? colors.textSecondary : colors.warningText,
              ),
            ),
            const SizedBox(height: AppSpacing.s16),
            Text(l10n.reviewTagsLabel, style: AppTextStyles.labelLarge),
            const SizedBox(height: AppSpacing.s8),
            Wrap(
              spacing: AppSpacing.s8,
              runSpacing: AppSpacing.s8,
              children: [
                for (final tag in ReviewTag.forSource(subject.source))
                  FilterChip(
                    key: ValueKey('review-tag-${tag.value}'),
                    label: Text(reviewTagLabel(l10n, tag)),
                    selected: _tags.contains(tag),
                    onSelected: (on) => setState(
                      () => on ? _tags.add(tag) : _tags.remove(tag),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.s16),
            AppTextField(
              key: const ValueKey('review-comment'),
              controller: _comment,
              label: l10n.reviewCommentLabel,
              hint: l10n.reviewCommentHint,
              optional: true,
              minLines: 3,
              maxLines: 5,
              maxLength: Review.maxCommentLength,
              textCapitalization: TextCapitalization.sentences,
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.s8),
              Text(
                _error!,
                style: AppTextStyles.body.copyWith(color: colors.errorText),
              ),
            ],
            const SizedBox(height: AppSpacing.s16),
            AppButton.primary(
              key: const ValueKey('review-submit'),
              label: widget.existing == null ? l10n.reviewSubmit : l10n.reviewSave,
              loading: _saving,
              expand: true,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}

/// The company writes (or rewords) its one reply to [review].
Future<void> showReplySheet(BuildContext context, Review review) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => _ReplySheet(review: review),
  );
}

class _ReplySheet extends ConsumerStatefulWidget {
  const _ReplySheet({required this.review});

  final Review review;

  @override
  ConsumerState<_ReplySheet> createState() => _ReplySheetState();
}

class _ReplySheetState extends ConsumerState<_ReplySheet> {
  late final _reply = TextEditingController(text: widget.review.reply);
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    if (_reply.text.trim().isEmpty) {
      setState(() => _error = l10n.reviewReplyRequired);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final error =
        await ref.read(reviewActionsProvider).reply(widget.review, _reply.text);
    if (!mounted) return;
    if (error != null) {
      setState(() {
        _saving = false;
        _error = error;
      });
      return;
    }
    Navigator.of(context).pop();
    showAppSnackBar(context, l10n.reviewReplySaved, tone: AppTone.success);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.s16,
          0,
          AppSpacing.s16,
          AppSpacing.s24,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.reviewReplyTitle, style: AppTextStyles.h2),
            const SizedBox(height: AppSpacing.s12),
            AppCard(child: ReviewTile(review: widget.review)),
            const SizedBox(height: AppSpacing.s16),
            AppTextField(
              key: const ValueKey('review-reply-text'),
              controller: _reply,
              hint: l10n.reviewReplyHint,
              minLines: 3,
              maxLines: 5,
              maxLength: Review.maxReplyLength,
              textCapitalization: TextCapitalization.sentences,
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.s8),
              Text(
                _error!,
                style: AppTextStyles.body
                    .copyWith(color: context.colors.errorText),
              ),
            ],
            const SizedBox(height: AppSpacing.s16),
            AppButton.primary(
              key: const ValueKey('review-reply-send'),
              label: l10n.reviewReplySend,
              loading: _saving,
              expand: true,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
