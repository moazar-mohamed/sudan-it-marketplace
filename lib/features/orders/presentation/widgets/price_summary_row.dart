import 'package:flutter/material.dart';

/// A label/value row for price summaries. The value wraps instead of
/// overflowing when the amount (e.g. a large SDG price) doesn't fit next
/// to the label on narrow screens.
class PriceSummaryRow extends StatelessWidget {
  const PriceSummaryRow({
    super.key,
    required this.label,
    required this.value,
    this.labelStyle,
    this.valueStyle,
  });

  final String label;
  final String value;
  final TextStyle? labelStyle;
  final TextStyle? valueStyle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: labelStyle)),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: valueStyle,
          ),
        ),
      ],
    );
  }
}
