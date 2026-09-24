import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';
import 'app_spinner.dart';

/// Emphasis of a button (Figma component "Button").
///
/// * [primary] – the one main action of a screen.
/// * [secondary] – supporting action on a tinted fill.
/// * [outlined] – neutral choice.
/// * [text] – low emphasis, links.
/// * [destructive] – irreversible action, used inside confirmation dialogs.
/// * [destructiveOutlined] – secondary destructive action ("Cancel request").
enum AppButtonVariant {
  primary,
  secondary,
  outlined,
  text,
  destructive,
  destructiveOutlined,
}

/// Large is the 48 px touch size on mobile, medium (40) is for dense areas and
/// web, small (32) sits inside cards and tables.
enum AppButtonSize { large, medium, small }

/// The design system button. One widget for every emphasis and size so screens
/// stop assembling Elevated/Filled/Outlined/Text buttons by hand.
///
/// While [loading] the label stays (so the width never jumps), a spinner shows,
/// and taps are ignored: the button never looks or behaves as if it were ready
/// for another press.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.large,
    this.icon,
    this.loading = false,
    this.expand = false,
  });

  const AppButton.primary({
    super.key,
    required this.label,
    required this.onPressed,
    this.size = AppButtonSize.large,
    this.icon,
    this.loading = false,
    this.expand = false,
  }) : variant = AppButtonVariant.primary;

  const AppButton.secondary({
    super.key,
    required this.label,
    required this.onPressed,
    this.size = AppButtonSize.large,
    this.icon,
    this.loading = false,
    this.expand = false,
  }) : variant = AppButtonVariant.secondary;

  const AppButton.outlined({
    super.key,
    required this.label,
    required this.onPressed,
    this.size = AppButtonSize.large,
    this.icon,
    this.loading = false,
    this.expand = false,
  }) : variant = AppButtonVariant.outlined;

  const AppButton.text({
    super.key,
    required this.label,
    required this.onPressed,
    this.size = AppButtonSize.medium,
    this.icon,
    this.loading = false,
    this.expand = false,
  }) : variant = AppButtonVariant.text;

  const AppButton.destructive({
    super.key,
    required this.label,
    required this.onPressed,
    this.size = AppButtonSize.large,
    this.icon,
    this.loading = false,
    this.expand = false,
  }) : variant = AppButtonVariant.destructive;

  const AppButton.destructiveOutlined({
    super.key,
    required this.label,
    required this.onPressed,
    this.size = AppButtonSize.large,
    this.icon,
    this.loading = false,
    this.expand = false,
  }) : variant = AppButtonVariant.destructiveOutlined;

  final String label;

  /// Null disables the button.
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final IconData? icon;
  final bool loading;

  /// Fill the available width (forms, dialogs on phones).
  final bool expand;

  double get _height => switch (size) {
        AppButtonSize.large => AppSize.controlLg,
        AppButtonSize.medium => AppSize.controlMd,
        AppButtonSize.small => AppSize.controlSm,
      };

  TextStyle get _textStyle => switch (size) {
        AppButtonSize.large => AppTextStyles.buttonLarge,
        AppButtonSize.medium => AppTextStyles.buttonMedium,
        AppButtonSize.small => AppTextStyles.buttonSmall,
      };

  double get _iconSize => switch (size) {
        AppButtonSize.large => AppSize.iconMd,
        AppButtonSize.medium => 18,
        AppButtonSize.small => AppSize.iconSm,
      };

  double get _padding => switch (size) {
        AppButtonSize.large => AppSpacing.s20,
        AppButtonSize.medium => AppSpacing.s16,
        AppButtonSize.small => AppSpacing.s12,
      };

  ButtonStyle _sizeStyle() => ButtonStyle(
        minimumSize: WidgetStatePropertyAll(Size(64, _height)),
        padding: WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: _padding),
        ),
        textStyle: WidgetStatePropertyAll(_textStyle),
      );

  ButtonStyle _secondaryStyle() => ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.disabled)
              ? AppColors.disabledBg
              : (s.contains(WidgetState.pressed) ||
                      s.contains(WidgetState.hovered))
                  ? AppColors.brandPrimarySubtleStrong
                  : AppColors.brandPrimarySubtle,
        ),
        foregroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.disabled)
              ? AppColors.disabledFg
              : AppColors.textBrand,
        ),
      );

  ButtonStyle _destructiveStyle() => ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.disabled)
              ? AppColors.disabledBg
              : (s.contains(WidgetState.pressed) ||
                      s.contains(WidgetState.hovered))
                  ? AppColors.errorText
                  : AppColors.error,
        ),
        foregroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.disabled)
              ? AppColors.disabledFg
              : AppColors.onPrimary,
        ),
      );

  ButtonStyle _destructiveOutlinedStyle() => ButtonStyle(
        foregroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.disabled)
              ? AppColors.disabledFg
              : AppColors.errorText,
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.pressed)
              ? AppColors.errorSubtle
              : AppColors.surface,
        ),
        side: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.disabled)
              ? AppBorder.card
              : const BorderSide(color: AppColors.borderError),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final foreground = switch (variant) {
      AppButtonVariant.primary || AppButtonVariant.destructive =>
        AppColors.onPrimary,
      AppButtonVariant.destructiveOutlined => AppColors.errorText,
      _ => AppColors.textBrand,
    };

    final content = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading) ...[
          AppSpinner(
            size: _iconSize - 2,
            strokeWidth: 2.2,
            color: foreground,
          ),
          const SizedBox(width: AppSpacing.s8),
        ] else if (icon != null) ...[
          Icon(icon, size: _iconSize),
          const SizedBox(width: AppSpacing.s8),
        ],
        Flexible(
          child: Text(label, textAlign: TextAlign.center),
        ),
      ],
    );

    // A loading button keeps its enabled colours, but a press does nothing.
    final VoidCallback? handler = loading ? () {} : onPressed;
    final base = _sizeStyle();

    final Widget button = switch (variant) {
      AppButtonVariant.primary => FilledButton(
          onPressed: handler,
          style: base,
          child: content,
        ),
      AppButtonVariant.secondary => FilledButton(
          onPressed: handler,
          style: _secondaryStyle().merge(base),
          child: content,
        ),
      AppButtonVariant.destructive => FilledButton(
          onPressed: handler,
          style: _destructiveStyle().merge(base),
          child: content,
        ),
      AppButtonVariant.outlined => OutlinedButton(
          onPressed: handler,
          style: base,
          child: content,
        ),
      AppButtonVariant.destructiveOutlined => OutlinedButton(
          onPressed: handler,
          style: _destructiveOutlinedStyle().merge(base),
          child: content,
        ),
      AppButtonVariant.text => TextButton(
          onPressed: handler,
          style: base.merge(
            ButtonStyle(
              minimumSize: WidgetStatePropertyAll(Size(48, _height)),
            ),
          ),
          child: content,
        ),
    };

    final guarded = IgnorePointer(ignoring: loading, child: button);
    // Screen readers hear a disabled button while a request is running.
    final semantic =
        loading ? Semantics(enabled: false, child: guarded) : guarded;
    return expand
        ? SizedBox(width: double.infinity, child: semantic)
        : semantic;
  }
}
