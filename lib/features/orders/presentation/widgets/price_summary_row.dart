import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';

/// A label/value row for price summaries. The value wraps instead of
/// overflowing when the amount (e.g. a large SDG price) doesn't fit next
/// to the label on narrow screens. [total] styles the grand total row.
class PriceSummaryRow extends StatelessWidget {
  const PriceSummaryRow({
    super.key,
    required this.label,
    required this.value,
    this.labelStyle,
    this.valueStyle,
    this.total = false,
  });

  final String label;
  final String value;
  final TextStyle? labelStyle;
  final TextStyle? valueStyle;
  final bool total;

  @override
  Widget build(BuildContext context) {
    final defaultLabel = total
        ? AppTextStyles.h3
        : AppTextStyles.body.copyWith(color: AppColors.textSecondary);
    final defaultValue = total
        ? AppTextStyles.h2.copyWith(color: AppColors.textBrand)
        : AppTextStyles.bodyStrong;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: labelStyle ?? defaultLabel)),
        const SizedBox(width: AppSpacing.s8),
        // Tight, so the value sits at the end of the row (text-align only
        // moves text inside the space the widget is given).
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: valueStyle ?? defaultValue,
          ),
        ),
      ],
    );
  }
}
