import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';

/// Horizontal progress tracker (Figma "Stepper · horizontal"): completed steps
/// are a filled check, the current one a filled dot, later ones an outline.
/// The step is also named in text, so progress never relies on colour.
class AppStepTracker extends StatelessWidget {
  const AppStepTracker({
    super.key,
    required this.labels,
    required this.currentIndex,
    this.allDone = false,
  });

  final List<String> labels;
  final int currentIndex;

  /// The last step is finished too (shows a check instead of the current dot).
  final bool allDone;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          Expanded(
            flex: 3,
            child: Column(
              children: [
                _Dot(
                  reached: i <= currentIndex,
                  done: i < currentIndex || (allDone && i == currentIndex),
                ),
                const SizedBox(height: AppSpacing.s6),
                Text(
                  labels[i],
                  textAlign: TextAlign.center,
                  style: AppTextStyles.labelSmall.copyWith(
                    fontWeight:
                        i == currentIndex ? FontWeight.w700 : FontWeight.w500,
                    color: i <= currentIndex
                        ? AppColors.textPrimary
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (i < labels.length - 1)
            Expanded(
              child: Container(
                height: 2,
                margin: const EdgeInsets.only(top: 13),
                color: i < currentIndex
                    ? AppColors.primary
                    : AppColors.borderDefault,
              ),
            ),
        ],
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.reached, required this.done});

  final bool reached;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: reached ? AppColors.primary : AppColors.surface,
        shape: BoxShape.circle,
        border: Border.all(
          color: reached ? AppColors.primary : AppColors.borderInput,
          width: AppBorder.thick,
        ),
      ),
      child: Icon(
        done ? Icons.check : (reached ? Icons.circle : Icons.circle_outlined),
        size: 14,
        color: reached ? AppColors.onPrimary : AppColors.iconMuted,
      ),
    );
  }
}
