import 'package:flutter/material.dart';

/// Colour tokens of the Sudan ICT Marketplace design system.
///
/// Since 2026-11-14 the identity is the customer site's (sictm.net,
/// `customer_web/src/styles.css`): navy `#063B73` as the main colour, green
/// `#1FA35C` on action buttons and prices ([action], [price]), and the
/// navy-to-teal hero. The original eight constants keep their names so
/// existing screens keep compiling; new code should use the semantic tokens.
class AppColors {
  AppColors._();

  // ---- Original constants (kept) ----
  static const Color primary = Color(0xFF063B73);
  static const Color secondary = Color(0xFF1FA35C);
  static const Color background = Color(0xFFF4F7FB);
  static const Color text = Color(0xFF12263F);
  static const Color success = Color(0xFF2E7D32);
  static const Color error = Color(0xFFD32F2F);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFFFFFFF);

  // ---- Brand ----
  static const Color brandPrimary = primary;
  static const Color brandPrimaryHover = Color(0xFF0A4A8C);
  static const Color brandPrimaryPressed = Color(0xFF052B57);
  static const Color brandPrimarySubtle = Color(0xFFE8F0FA);
  static const Color brandPrimarySubtleStrong = Color(0xFFDDE5EF);
  static const Color brandSecondary = secondary;
  static const Color brandSecondarySubtle = Color(0xFFE5F7FD);

  // ---- Backgrounds ----
  static const Color bgApp = background;
  static const Color bgSurface = surface;
  static const Color bgSubtle = Color(0xFFEEF3F9);
  static const Color bgMuted = Color(0xFFEEF3F9);
  static const Color bgInverse = Color(0xFF063B73);
  static const Color bgScrim = Color(0x8012263F);

  // ---- Text (all pass WCAG AA 4.5:1 on white, see test/theme_tokens_test) ----
  static const Color textPrimary = text;
  static const Color textSecondary = Color(0xFF5D6F86);
  static const Color textTertiary = Color(0xFF5D6F86);
  static const Color textDisabled = Color(0xFFA9B4C4);
  static const Color textOnPrimary = onPrimary;
  static const Color textBrand = primary;
  static const Color textInverse = Color(0xFFFFFFFF);

  // ---- Borders (input/strong meet the 3:1 non-text contrast) ----
  static const Color borderDefault = Color(0xFFDDE5EF);
  static const Color borderInput = Color(0xFF7F8CA0);
  static const Color borderStrong = Color(0xFF7F8CA0);
  static const Color borderFocus = primary;
  static const Color borderError = error;
  static const Color borderFocusRing = Color(0xFF1FA35C);

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
  static const Color infoSubtle = Color(0xFFE8F0FA);
  static const Color infoText = Color(0xFF063B73);
  static const Color progress = Color(0xFFE64A19);
  static const Color progressSubtle = Color(0xFFFBE9E7);
  static const Color progressText = Color(0xFFBF360C);

  // ---- Disabled ----
  static const Color disabledBg = Color(0xFFDDE5EF);
  static const Color disabledFg = Color(0xFF7F8CA0);

  // ---- The customer site's look (sictm.net) ----
  /// Main action buttons (Buy now, Search, Save...): `--action`.
  static const Color action = Color(0xFF1FA35C);
  static const Color actionPressed = Color(0xFF188A4D);
  /// Prices: `--price`.
  static const Color price = Color(0xFF1FA35C);
  /// The top bar: `--nav-bg`, navy in light and dark.
  static const Color navBar = Color(0xFF063B73);
  /// The home hero: navy to teal (`.home-hero`).
  static const Color heroStart = Color(0xFF052B57);
  static const Color heroMid = Color(0xFF0A5F86);
  static const Color heroEnd = Color(0xFF0F8F7D);
}

/// The meaning of a coloured chip, banner or icon tile. One colour always
/// means one thing across the product (Figma: "Status colour language").
/// The actual colours come from the current [AppColorTokens] (light or
/// dark), via [background], [foreground] and [accent].
enum AppTone { neutral, brand, success, warning, error, info, progress }

/// Resolves an [AppTone] against whichever palette ([AppColorTokens.light]
/// or [AppColorTokens.dark]) is currently active, so a chip or icon tile
/// stays correct when the user switches appearance.
extension AppToneColors on AppTone {
  /// Tinted fill behind the content.
  Color background(AppColorTokens c) => switch (this) {
        AppTone.neutral => c.bgMuted,
        AppTone.brand => c.brandPrimarySubtle,
        AppTone.success => c.successSubtle,
        AppTone.warning => c.warningSubtle,
        AppTone.error => c.errorSubtle,
        AppTone.info => c.infoSubtle,
        AppTone.progress => c.progressSubtle,
      };

  /// Text colour on [background] (>= 4.5:1).
  Color foreground(AppColorTokens c) => switch (this) {
        AppTone.neutral => c.textSecondary,
        AppTone.brand => c.infoText,
        AppTone.success => c.successText,
        AppTone.warning => c.warningText,
        AppTone.error => c.errorText,
        AppTone.info => c.infoText,
        AppTone.progress => c.progressText,
      };

  /// Dot / icon colour.
  Color accent(AppColorTokens c) => switch (this) {
        AppTone.neutral => c.iconMuted,
        AppTone.brand => c.iconBrand,
        AppTone.success => c.success,
        AppTone.warning => c.warning,
        AppTone.error => c.error,
        AppTone.info => c.info,
        AppTone.progress => c.progress,
      };
}

/// Every colour token as one bundle, swapped whole when the user changes
/// appearance (Settings > Appearance). [AppColorTokens.light] mirrors
/// [AppColors] field for field; [AppColorTokens.dark] is the matching dark
/// palette (same hues, re-balanced so text/border pairs still clear WCAG AA,
/// see `test/theme_tokens_test.dart`). Attached to [ThemeData] as a
/// [ThemeExtension] and read in widgets via `context.colors`.
@immutable
class AppColorTokens extends ThemeExtension<AppColorTokens> {
  const AppColorTokens({
    required this.primary,
    required this.secondary,
    required this.background,
    required this.text,
    required this.success,
    required this.error,
    required this.onPrimary,
    required this.surface,
    required this.brandPrimary,
    required this.brandPrimaryHover,
    required this.brandPrimaryPressed,
    required this.brandPrimarySubtle,
    required this.brandPrimarySubtleStrong,
    required this.brandSecondary,
    required this.brandSecondarySubtle,
    required this.bgApp,
    required this.bgSurface,
    required this.bgSubtle,
    required this.bgMuted,
    required this.bgInverse,
    required this.bgScrim,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.textDisabled,
    required this.textOnPrimary,
    required this.textBrand,
    required this.textInverse,
    required this.borderDefault,
    required this.borderInput,
    required this.borderStrong,
    required this.borderFocus,
    required this.borderError,
    required this.borderFocusRing,
    required this.iconDefault,
    required this.iconMuted,
    required this.iconBrand,
    required this.successSubtle,
    required this.successText,
    required this.warning,
    required this.warningSubtle,
    required this.warningText,
    required this.errorSubtle,
    required this.errorText,
    required this.info,
    required this.infoSubtle,
    required this.infoText,
    required this.progress,
    required this.progressSubtle,
    required this.progressText,
    required this.disabledBg,
    required this.disabledFg,
    this.action = AppColors.action,
    this.actionPressed = AppColors.actionPressed,
    this.price = AppColors.price,
    this.navBar = AppColors.navBar,
    this.heroStart = AppColors.heroStart,
    this.heroMid = AppColors.heroMid,
    this.heroEnd = AppColors.heroEnd,
  });

  final Color primary;
  final Color secondary;
  final Color background;
  final Color text;
  final Color success;
  final Color error;
  final Color onPrimary;
  final Color surface;
  final Color brandPrimary;
  final Color brandPrimaryHover;
  final Color brandPrimaryPressed;
  final Color brandPrimarySubtle;
  final Color brandPrimarySubtleStrong;
  final Color brandSecondary;
  final Color brandSecondarySubtle;
  final Color bgApp;
  final Color bgSurface;
  final Color bgSubtle;
  final Color bgMuted;
  final Color bgInverse;
  final Color bgScrim;
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color textDisabled;
  final Color textOnPrimary;
  final Color textBrand;
  final Color textInverse;
  final Color borderDefault;
  final Color borderInput;
  final Color borderStrong;
  final Color borderFocus;
  final Color borderError;
  final Color borderFocusRing;
  final Color iconDefault;
  final Color iconMuted;
  final Color iconBrand;
  final Color successSubtle;
  final Color successText;
  final Color warning;
  final Color warningSubtle;
  final Color warningText;
  final Color errorSubtle;
  final Color errorText;
  final Color info;
  final Color infoSubtle;
  final Color infoText;
  final Color progress;
  final Color progressSubtle;
  final Color progressText;
  final Color disabledBg;
  final Color disabledFg;
  final Color action;
  final Color actionPressed;
  final Color price;
  final Color navBar;
  final Color heroStart;
  final Color heroMid;
  final Color heroEnd;

  /// The light palette: the customer site's `:root` tokens.
  static const AppColorTokens light = AppColorTokens(
    primary: AppColors.primary,
    secondary: AppColors.secondary,
    background: AppColors.background,
    text: AppColors.text,
    success: AppColors.success,
    error: AppColors.error,
    onPrimary: AppColors.onPrimary,
    surface: AppColors.surface,
    brandPrimary: AppColors.brandPrimary,
    brandPrimaryHover: AppColors.brandPrimaryHover,
    brandPrimaryPressed: AppColors.brandPrimaryPressed,
    brandPrimarySubtle: AppColors.brandPrimarySubtle,
    brandPrimarySubtleStrong: AppColors.brandPrimarySubtleStrong,
    brandSecondary: AppColors.brandSecondary,
    brandSecondarySubtle: AppColors.brandSecondarySubtle,
    bgApp: AppColors.bgApp,
    bgSurface: AppColors.bgSurface,
    bgSubtle: AppColors.bgSubtle,
    bgMuted: AppColors.bgMuted,
    bgInverse: AppColors.bgInverse,
    bgScrim: AppColors.bgScrim,
    textPrimary: AppColors.textPrimary,
    textSecondary: AppColors.textSecondary,
    textTertiary: AppColors.textTertiary,
    textDisabled: AppColors.textDisabled,
    textOnPrimary: AppColors.textOnPrimary,
    textBrand: AppColors.textBrand,
    textInverse: AppColors.textInverse,
    borderDefault: AppColors.borderDefault,
    borderInput: AppColors.borderInput,
    borderStrong: AppColors.borderStrong,
    borderFocus: AppColors.borderFocus,
    borderError: AppColors.borderError,
    borderFocusRing: AppColors.borderFocusRing,
    iconDefault: AppColors.iconDefault,
    iconMuted: AppColors.iconMuted,
    iconBrand: AppColors.iconBrand,
    successSubtle: AppColors.successSubtle,
    successText: AppColors.successText,
    warning: AppColors.warning,
    warningSubtle: AppColors.warningSubtle,
    warningText: AppColors.warningText,
    errorSubtle: AppColors.errorSubtle,
    errorText: AppColors.errorText,
    info: AppColors.info,
    infoSubtle: AppColors.infoSubtle,
    infoText: AppColors.infoText,
    progress: AppColors.progress,
    progressSubtle: AppColors.progressSubtle,
    progressText: AppColors.progressText,
    disabledBg: AppColors.disabledBg,
    disabledFg: AppColors.disabledFg,
  );

  /// The dark palette: the customer site's `:root[data-theme='dark']`
  /// tokens. The bar stays navy as on the site; the brand blue used as text
  /// or an icon is `#5B9BE8`, a touch lighter than the site's `#4A90E2`, so
  /// it still clears 4.5:1 on the soft fill (see `test/theme_tokens_test.dart`).
  static const AppColorTokens dark = AppColorTokens(
    primary: Color(0xFF063B73),
    secondary: Color(0xFF1FA35C),
    background: Color(0xFF0B1523),
    text: Color(0xFFE6EEF9),
    success: Color(0xFF4CAF50),
    error: Color(0xFFD32F2F),
    onPrimary: Color(0xFFFFFFFF),
    surface: Color(0xFF13233A),
    brandPrimary: Color(0xFF063B73),
    brandPrimaryHover: Color(0xFF0A4A8C),
    brandPrimaryPressed: Color(0xFF052B57),
    brandPrimarySubtle: Color(0xFF182C48),
    brandPrimarySubtleStrong: Color(0xFF1E3352),
    brandSecondary: Color(0xFF1FA35C),
    brandSecondarySubtle: Color(0xFF14313D),
    bgApp: Color(0xFF0B1523),
    bgSurface: Color(0xFF13233A),
    bgSubtle: Color(0xFF182C48),
    bgMuted: Color(0xFF1E3352),
    bgInverse: Color(0xFFE6EEF9),
    bgScrim: Color(0xB3000000),
    textPrimary: Color(0xFFE6EEF9),
    textSecondary: Color(0xFF93A7C2),
    textTertiary: Color(0xFF93A7C2),
    textDisabled: Color(0xFF5A6A80),
    textOnPrimary: Color(0xFFFFFFFF),
    textBrand: Color(0xFF5B9BE8),
    textInverse: Color(0xFF12263F),
    borderDefault: Color(0xFF25395A),
    borderInput: Color(0xFF7F8CA0),
    borderStrong: Color(0xFF7F8CA0),
    borderFocus: Color(0xFF5B9BE8),
    borderError: Color(0xFFEF5350),
    borderFocusRing: Color(0xFF1FA35C),
    iconDefault: Color(0xFFC3CEDD),
    iconMuted: Color(0xFF93A7C2),
    iconBrand: Color(0xFF5B9BE8),
    successSubtle: Color(0xFF16321B),
    successText: Color(0xFF7FD38A),
    warning: Color(0xFFFFB74D),
    warningSubtle: Color(0xFF3A2A0E),
    warningText: Color(0xFFFFC97A),
    errorSubtle: Color(0xFF3B1616),
    errorText: Color(0xFFFF8A80),
    info: Color(0xFF5B9BE8),
    infoSubtle: Color(0xFF182C48),
    infoText: Color(0xFF8FBFFF),
    progress: Color(0xFFFF8A65),
    progressSubtle: Color(0xFF3A2015),
    progressText: Color(0xFFFFAB91),
    disabledBg: Color(0xFF1E3352),
    disabledFg: Color(0xFF7F8CA0),
  );

  @override
  AppColorTokens copyWith() => this;

  @override
  AppColorTokens lerp(ThemeExtension<AppColorTokens>? other, double t) {
    if (other is! AppColorTokens) return this;
    return t < 0.5 ? this : other;
  }
}

/// The colour tokens for the current appearance (light or dark), wherever a
/// [BuildContext] is available. Falls back to [AppColorTokens.light] if the
/// theme somehow has none (never happens once [AppTheme] attaches it).
extension AppColorsContext on BuildContext {
  AppColorTokens get colors =>
      Theme.of(this).extension<AppColorTokens>() ?? AppColorTokens.light;
}
