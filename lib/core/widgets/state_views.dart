import 'package:flutter/material.dart';

import '../localization/l10n_extension.dart';
import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';
import 'app_button.dart';
import 'app_spinner.dart';
import 'app_surfaces.dart';

/// Empty, no-result and offline states (Figma component "Empty state"):
/// a tinted 72 px icon circle, an optional title, a message and an optional
/// action. Empty = invite the next action; no results = suggest changing the
/// query.
class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    super.key,
    required this.icon,
    required this.message,
    this.title,
    this.action,
    this.tone = AppTone.neutral,
    this.expandVertically = false,
  });

  final IconData icon;
  final String message;
  final String? title;

  /// Optional call to action shown under the message.
  final Widget? action;
  final AppTone tone;

  /// Centre in the remaining screen height (full-screen empty states).
  final bool expandVertically;

  @override
  Widget build(BuildContext context) {
    final content = _StateColumn(
      icon: icon,
      tone: tone,
      title: title,
      message: message,
      action: action,
    );
    // Always centred horizontally; only full-screen states also centre
    // vertically.
    return expandVertically
        ? Center(child: content)
        : Center(heightFactor: 1, child: content);
  }
}

/// Load failure with a retry action (Figma "Empty state · Error").
class AppErrorState extends StatelessWidget {
  const AppErrorState({
    super.key,
    required this.message,
    this.onRetry,
    this.title,
    this.icon = Icons.error_outline_rounded,
  });

  final String message;
  final VoidCallback? onRetry;
  final String? title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: _StateColumn(
        icon: icon,
        tone: AppTone.error,
        title: title,
        message: message,
        action: onRetry == null
            ? null
            : AppButton.outlined(
                label: context.l10n.commonRetry,
                size: AppButtonSize.medium,
                onPressed: onRetry,
              ),
      ),
    );
  }
}

class _StateColumn extends StatelessWidget {
  const _StateColumn({
    required this.icon,
    required this.tone,
    required this.message,
    this.title,
    this.action,
  });

  final IconData icon;
  final AppTone tone;
  final String message;
  final String? title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.s32,
        horizontal: AppSpacing.s24,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppIconTile(
              icon: icon,
              tone: tone,
              size: 72,
              radius: AppRadius.full,
              iconSize: AppSize.iconXl,
            ),
            const SizedBox(height: AppSpacing.s12),
            if (title != null) ...[
              Text(
                title!,
                textAlign: TextAlign.center,
                style: AppTextStyles.h3,
              ),
              const SizedBox(height: AppSpacing.s4),
            ],
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
            ),
            if (action != null) ...[
              const SizedBox(height: AppSpacing.s16),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Full-area spinner (Figma "Loading state · Spinner"). Use it for whole-screen
/// or first loads; use [AppSkeletonList] when the list shape is known.
class AppLoadingState extends StatelessWidget {
  const AppLoadingState({super.key, this.label});

  final String? label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AppSpinner(size: 32, strokeWidth: 3),
            if (label != null) ...[
              const SizedBox(height: AppSpacing.s12),
              Text(
                label!,
                style: AppTextStyles.body.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Placeholder rows that keep the layout stable while a list loads (Figma
/// "Loading state · List skeleton"). Static on purpose: no animation to run
/// in tests or to disable for "reduce motion".
class AppSkeletonList extends StatelessWidget {
  const AppSkeletonList({super.key, this.count = 3});

  final int count;

  Widget _bar(double width, double height) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: AppColors.bgMuted,
          borderRadius: BorderRadius.circular(AppRadius.xs),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Column(
        children: [
          for (var i = 0; i < count; i++) ...[
            AppCard(
              child: Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: AppColors.bgMuted,
                      borderRadius: AppRadius.smAll,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _bar(180, 14),
                        const SizedBox(height: AppSpacing.s8),
                        _bar(110, 10),
                        const SizedBox(height: AppSpacing.s8),
                        _bar(70, 12),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (i < count - 1) const SizedBox(height: AppSpacing.s12),
          ],
        ],
      ),
    );
  }
}
