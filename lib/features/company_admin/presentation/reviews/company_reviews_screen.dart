import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/review_widgets.dart';
import '../../../reviews/presentation/reviews_providers.dart';

/// Every rating customers gave the company, newest first, with a reply
/// button on each. Hidden ones are marked and left out of the summary.
class CompanyReviewsScreen extends ConsumerWidget {
  const CompanyReviewsScreen({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final reviewsAsync = ref.watch(companyReviewsProvider(companyId));
    return Scaffold(
      appBar: AppBar(title: Text(l10n.companyReviewsTitle)),
      body: reviewsAsync.when(
        loading: () => const AppLoadingState(),
        error: (_, _) => AppErrorState(
          message: l10n.reviewLoadFailed,
          onRetry: () => ref.invalidate(companyReviewsProvider(companyId)),
        ),
        data: (reviews) {
          if (reviews.isEmpty) {
            return AppEmptyState(
              icon: Icons.star_outline_rounded,
              message: l10n.reviewsEmpty,
            );
          }
          final visible = [
            for (final review in reviews)
              if (!review.hidden) review,
          ];
          return AppCenteredList(
            children: [
              if (visible.isNotEmpty)
                AppCard(
                  padding: const EdgeInsets.all(AppSpacing.s16),
                  child: RatingSummary(reviews: visible),
                ),
              for (final review in reviews) ...[
                const SizedBox(height: AppSpacing.s12),
                AppCard(
                  key: ValueKey('company-review-${review.id}'),
                  padding: const EdgeInsets.all(AppSpacing.s16),
                  child: ReviewTile(
                    review: review,
                    showTarget: true,
                    footer: _ReplyButton(review: review),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _ReplyButton extends StatelessWidget {
  const _ReplyButton({required this.review});

  final Review review;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: AppButton(
        variant: review.hasReply
            ? AppButtonVariant.outlined
            : AppButtonVariant.secondary,
        size: AppButtonSize.medium,
        icon: Icons.reply_rounded,
        label: review.hasReply
            ? l10n.reviewEditReplyAction
            : l10n.reviewReplyAction,
        onPressed: () => showReplySheet(context, review),
      ),
    );
  }
}

/// The Account tab row: the average and how many ratings still need a reply.
class CompanyReviewsRow extends ConsumerWidget {
  const CompanyReviewsRow({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final colors = context.colors;
    final reviews =
        ref.watch(companyReviewsProvider(companyId)).asData?.value ?? const [];
    final unanswered =
        reviews.where((review) => !review.hidden && !review.hasReply).length;
    return AppListCard(
      key: const ValueKey('account-reviews'),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => CompanyReviewsScreen(companyId: companyId),
        ),
      ),
      leading: const AppIconTile(
        icon: Icons.star_outline_rounded,
        size: 40,
        iconSize: AppSize.iconMd,
      ),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.companyReviewsTitle, style: AppTextStyles.bodyStrong),
          RatingLine(ratingsKey: RatingStats.companyKey(companyId)),
        ],
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (unanswered > 0)
            StatusChip(
              label: l10n.companyReviewsNeedReply(unanswered),
              tone: AppTone.warning,
              showDot: false,
            ),
          const SizedBox(width: AppSpacing.s4),
          Icon(Icons.chevron_right_rounded, color: colors.iconMuted),
        ],
      ),
    );
  }
}
