import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';

/// One chip for every status in the product (Figma component "Status chip").
///
/// Colour carries the meaning ([AppTone]) but never alone: the dot AND the text
/// label always travel together.
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    required this.tone,
    this.showDot = true,
  });

  final String label;
  final AppTone tone;

  /// Drop the dot for chips that are labels rather than states (a category).
  final bool showDot;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 26),
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: AppSpacing.s4,
      ),
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: AppRadius.smAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showDot) ...[
            Container(
              width: 8,
              height: 8,
              decoration:
                  BoxDecoration(color: tone.accent, shape: BoxShape.circle),
            ),
            const SizedBox(width: AppSpacing.s6),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.labelMedium.copyWith(color: tone.foreground),
            ),
          ),
        ],
      ),
    );
  }
}
