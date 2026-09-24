import 'package:flutter/material.dart';

import '../localization/l10n_extension.dart';
import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';

/// Quantity control "− 2 +" (Figma component "Stepper"). Each side is a 48 px
/// touch target; a side that cannot move any further is greyed out and inert.
class AppQuantityStepper extends StatelessWidget {
  const AppQuantityStepper({
    super.key,
    required this.value,
    required this.canDecrement,
    required this.canIncrement,
    required this.onDecrement,
    required this.onIncrement,
  });

  final int value;
  final bool canDecrement;
  final bool canIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.smAll,
        border: Border.all(color: AppColors.borderInput),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: l10n.commonQuantityDecrease,
            onPressed: canDecrement ? onDecrement : null,
            icon: const Icon(Icons.remove, size: AppSize.iconMd),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: AppSpacing.s24),
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: AppTextStyles.h3,
            ),
          ),
          IconButton(
            tooltip: l10n.commonQuantityIncrease,
            onPressed: canIncrement ? onIncrement : null,
            icon: const Icon(Icons.add, size: AppSize.iconMd),
          ),
        ],
      ),
    );
  }
}
