import 'package:flutter/material.dart';

/// Colour tokens of the Sudan ICT Marketplace design system (Figma:
/// "03 — Colors", collection Color / Light).
///
/// The brand colours are the product's visual identity and never change:
/// primary `#1565C0` and secondary `#00A8E8`. The original eight constants
/// keep their names so existing screens keep compiling; new code should use
/// the semantic tokens below.
class AppColors {
  AppColors._();

  // ---- Original constants (kept) ----
  static const Color primary = Color(0xFF1565C0);
  static const Color secondary = Color(0xFF00A8E8);
  static const Color background = Color(0xFFF7F9FC);
  static const Color text = Color(0xFF172033);
  static const Color success = Color(0xFF2E7D32);
  static const Color error = Color(0xFFD32F2F);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFFFFFFF);

  // ---- Brand ----
  static const Color brandPrimary = primary;
  static const Color brandPrimaryHover = Color(0xFF12579F);
  static const Color brandPrimaryPressed = Color(0xFF0E4680);
  static const Color brandPrimarySubtle = Color(0xFFE8F1FB);
  static const Color brandPrimarySubtleStrong = Color(0xFFD0E3F7);
  static const Color brandSecondary = secondary;
  static const Color brandSecondarySubtle = Color(0xFFE5F7FD);

  // ---- Backgrounds ----
  static const Color bgApp = background;
  static const Color bgSurface = surface;
  static const Color bgSubtle = Color(0xFFEEF2F7);
  static const Color bgMuted = Color(0xFFE3E8EF);
  static const Color bgInverse = Color(0xFF172033);
  static const Color bgScrim = Color(0x80172033);

  // ---- Text (all pass WCAG AA 4.5:1 on white, see test/theme_tokens_test) ----
  static const Color textPrimary = text;
  static const Color textSecondary = Color(0xFF5A667B);
  static const Color textTertiary = Color(0xFF66738A);
  static const Color textDisabled = Color(0xFFA9B4C4);
  static const Color textOnPrimary = onPrimary;
  static const Color textBrand = primary;
  static const Color textInverse = Color(0xFFFFFFFF);

  // ---- Borders (input/strong meet the 3:1 non-text contrast) ----
  static const Color borderDefault = Color(0xFFE3E8EF);
  static const Color borderInput = Color(0xFF7F8CA0);
  static const Color borderStrong = Color(0xFF7F8CA0);
  static const Color borderFocus = primary;
  static const Color borderError = error;
  static const Color borderFocusRing = Color(0xFF0080B3);

  // ---- Icons ----
  static const Color iconDefault = Color(0xFF45516A);
  static const Color iconMuted = Color(0xFF7F8CA0);
  static const Color iconBrand = primary;

  // ---- Status ----
  static const Color successSubtle = Color(0xFFE8F5E9);
  static const Color successText = Color(0xFF1B5E20);
  static const Color warning = Color(0xFFFF8F00);
  static const Color warningSubtle = Color(0xFFFFF4E0);
  static const Color warningText = Color(0xFF8A5100);
  static const Color errorSubtle = Color(0xFFFDECEA);
  static const Color errorText = Color(0xFFA62222);
  static const Color info = primary;
  static const Color infoSubtle = Color(0xFFE8F1FB);
  static const Color infoText = Color(0xFF0E4680);
  static const Color progress = Color(0xFFE64A19);
  static const Color progressSubtle = Color(0xFFFBE9E7);
  static const Color progressText = Color(0xFFBF360C);

  // ---- Disabled ----
  static const Color disabledBg = Color(0xFFE3E8EF);
  static const Color disabledFg = Color(0xFF7F8CA0);
}

/// The meaning of a coloured chip, banner or icon tile. One colour always
/// means one thing across the product (Figma: "Status colour language").
enum AppTone {
  neutral(
    background: AppColors.bgMuted,
    foreground: AppColors.textSecondary,
    accent: AppColors.iconMuted,
  ),
  brand(
    background: AppColors.brandPrimarySubtle,
    foreground: AppColors.brandPrimaryPressed,
    accent: AppColors.primary,
  ),
  success(
    background: AppColors.successSubtle,
    foreground: AppColors.successText,
    accent: AppColors.success,
  ),
  warning(
    background: AppColors.warningSubtle,
    foreground: AppColors.warningText,
    accent: AppColors.warning,
  ),
  error(
    background: AppColors.errorSubtle,
    foreground: AppColors.errorText,
    accent: AppColors.error,
  ),
  info(
    background: AppColors.infoSubtle,
    foreground: AppColors.infoText,
    accent: AppColors.info,
  ),
  progress(
    background: AppColors.progressSubtle,
    foreground: AppColors.progressText,
    accent: AppColors.progress,
  );

  const AppTone({
    required this.background,
    required this.foreground,
    required this.accent,
  });

  /// Tinted fill behind the content.
  final Color background;

  /// Text colour on [background] (>= 4.5:1).
  final Color foreground;

  /// Dot / icon colour.
  final Color accent;
}
