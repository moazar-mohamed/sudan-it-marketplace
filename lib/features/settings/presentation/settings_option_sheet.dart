import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';

/// One choice in a [showSettingsOptionSheet].
class SettingsOption<T> {
  const SettingsOption({
    required this.value,
    required this.label,
    required this.leading,
    this.subtitle,
  });

  final T value;
  final String label;
  final String? subtitle;
  final Widget leading;
}

/// A bottom sheet listing mutually exclusive choices as cards, the current
/// one ticked. Returns the tapped value, or null when dismissed.
Future<T?> showSettingsOptionSheet<T>(
  BuildContext context, {
  required String title,
  required String subtitle,
  required List<SettingsOption<T>> options,
  required T selected,
}) {
  return showModalBottomSheet<T>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.s16,
          0,
          AppSpacing.s16,
          AppSpacing.s24,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: AppTextStyles.h2),
            const SizedBox(height: AppSpacing.s4),
            Text(
              subtitle,
              style: AppTextStyles.caption.copyWith(
                color: sheetContext.colors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.s16),
            for (final option in options) ...[
              _OptionTile(
                key: ValueKey('settings-option-${option.value}'),
                option: option,
                selected: option.value == selected,
                onTap: () => Navigator.of(sheetContext).pop(option.value),
              ),
              const SizedBox(height: AppSpacing.s8),
            ],
          ],
        ),
      ),
    ),
  );
}

class _OptionTile<T> extends StatelessWidget {
  const _OptionTile({
    super.key,
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final SettingsOption<T> option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final subtitle = option.subtitle;
    return Semantics(
      selected: selected,
      inMutuallyExclusiveGroup: true,
      button: true,
      child: Material(
        color: selected ? colors.brandPrimarySubtle : colors.bgSurface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.mdAll,
          side: BorderSide(
            color: selected ? colors.borderFocus : colors.borderDefault,
            width: selected ? AppBorder.thick : AppBorder.thin,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: AppSize.touchMin + 16),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.s12,
                vertical: AppSpacing.s8,
              ),
              child: Row(
                children: [
                  option.leading,
                  const SizedBox(width: AppSpacing.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(option.label, style: AppTextStyles.bodyStrong),
                        if (subtitle != null)
                          Text(
                            subtitle,
                            style: AppTextStyles.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.s8),
                  Icon(
                    selected
                        ? Icons.check_circle_rounded
                        : Icons.radio_button_unchecked_rounded,
                    color: selected ? colors.iconBrand : colors.borderStrong,
                    size: AppSize.iconLg,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
