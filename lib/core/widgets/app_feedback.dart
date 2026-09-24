import 'package:flutter/material.dart';

import '../localization/l10n_extension.dart';
import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';
import 'app_button.dart';

/// Asks before an irreversible action (cancel, reject, delete, deactivate).
/// The safe choice is the text button at the start; [destructive] turns the
/// confirmation red. Resolves to true only when the user confirms.
Future<bool> showConfirmationDialog(
  BuildContext context, {
  required String title,
  required String body,
  required String confirmLabel,
  String? cancelLabel,
  bool destructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        AppButton.text(
          label: cancelLabel ?? context.l10n.commonCancel,
          onPressed: () => Navigator.of(dialogContext).pop(false),
        ),
        destructive
            ? AppButton.destructive(
                label: confirmLabel,
                size: AppButtonSize.medium,
                onPressed: () => Navigator.of(dialogContext).pop(true),
              )
            : AppButton.primary(
                label: confirmLabel,
                size: AppButtonSize.medium,
                onPressed: () => Navigator.of(dialogContext).pop(true),
              ),
      ],
    ),
  );
  return result ?? false;
}

/// Inline message inside a screen or form (Figma component "Alert"). Always an
/// icon plus text; the tinted background is decoration, not the only signal.
class AppBanner extends StatelessWidget {
  const AppBanner({
    super.key,
    required this.message,
    this.title,
    this.tone = AppTone.info,
    this.icon,
    this.action,
  });

  final String message;
  final String? title;
  final AppTone tone;
  final IconData? icon;

  /// Optional action (for example a retry link) below the text.
  final Widget? action;

  static IconData defaultIcon(AppTone tone) => switch (tone) {
        AppTone.success => Icons.check_circle_outline_rounded,
        AppTone.warning => Icons.warning_amber_rounded,
        AppTone.error => Icons.error_outline_rounded,
        _ => Icons.info_outline_rounded,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.s12),
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: AppRadius.mdAll,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon ?? defaultIcon(tone), size: AppSize.iconMd, color: tone.accent),
          const SizedBox(width: AppSpacing.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null)
                  Text(
                    title!,
                    style: AppTextStyles.labelLarge
                        .copyWith(color: tone.foreground),
                  ),
                Text(message, style: AppTextStyles.caption),
                if (action != null) ...[
                  const SizedBox(height: AppSpacing.s8),
                  action!,
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Transient confirmation at the bottom of the screen (Figma "Snackbar").
/// Errors stay 6 s so they can be read; everything else 4 s.
void showAppSnackBar(
  BuildContext context,
  String message, {
  AppTone tone = AppTone.neutral,
  SnackBarAction? action,

  /// Captured before the screen that showed the message is closed.
  ScaffoldMessengerState? messenger,
}) {
  final leading = switch (tone) {
    AppTone.success => const Icon(
        Icons.check_circle_outline_rounded,
        color: AppColors.success,
        size: AppSize.iconMd,
      ),
    AppTone.error => const Icon(
        Icons.error_outline_rounded,
        color: AppColors.error,
        size: AppSize.iconMd,
      ),
    _ => null,
  };
  (messenger ?? ScaffoldMessenger.of(context))
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        duration: Duration(seconds: tone == AppTone.error ? 6 : 4),
        action: action,
        content: Row(
          children: [
            if (leading != null) ...[
              leading,
              const SizedBox(width: AppSpacing.s12),
            ],
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
}
