import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Typography tokens (Figma: "04 — Typography"). One family, Cairo, carries
/// both Latin and Arabic in four weights. Line heights are generous so Arabic
/// diacritics never clip.
class AppFonts {
  AppFonts._();

  static const String family = 'Cairo';
}

class AppTextStyles {
  AppTextStyles._();

  static TextStyle _s(double size, double lineHeight, FontWeight weight) =>
      TextStyle(
        fontFamily: AppFonts.family,
        fontSize: size,
        height: lineHeight / size,
        fontWeight: weight,
        color: AppColors.textPrimary,
      );

  static final TextStyle display = _s(32, 44, FontWeight.w700);
  static final TextStyle h1 = _s(24, 34, FontWeight.w700);
  static final TextStyle h2 = _s(20, 30, FontWeight.w600);
  static final TextStyle h3 = _s(16, 26, FontWeight.w600);
  static final TextStyle bodyLarge = _s(16, 26, FontWeight.w400);
  static final TextStyle bodyLargeStrong = _s(16, 26, FontWeight.w600);
  static final TextStyle body = _s(14, 22, FontWeight.w400);
  static final TextStyle bodyStrong = _s(14, 22, FontWeight.w600);
  static final TextStyle caption = _s(12, 18, FontWeight.w400);
  static final TextStyle captionStrong = _s(12, 18, FontWeight.w600);
  static final TextStyle buttonLarge = _s(16, 24, FontWeight.w600);
  static final TextStyle buttonMedium = _s(14, 20, FontWeight.w600);
  static final TextStyle buttonSmall = _s(13, 18, FontWeight.w600);
  static final TextStyle labelLarge = _s(14, 20, FontWeight.w500);
  static final TextStyle labelMedium = _s(12, 16, FontWeight.w500);
  static final TextStyle labelSmall = _s(11, 14, FontWeight.w500);
  static final TextStyle stat = _s(28, 36, FontWeight.w700);

  /// The Material [TextTheme] built from the tokens above, so every existing
  /// `Theme.of(context).textTheme.*` picks up the design system:
  /// headlineLarge = Display, headlineMedium = Stat, headlineSmall = H1,
  /// titleLarge = H2, titleMedium = H3, titleSmall = Body strong, body* =
  /// Body large / Body / Caption, label* = Label large / medium / small.
  static TextTheme get textTheme => TextTheme(
        displayLarge: display,
        displayMedium: display,
        displaySmall: display,
        headlineLarge: display,
        headlineMedium: stat,
        headlineSmall: h1,
        titleLarge: h2,
        titleMedium: h3,
        titleSmall: bodyStrong,
        bodyLarge: bodyLarge,
        bodyMedium: body,
        bodySmall: caption,
        labelLarge: labelLarge,
        labelMedium: labelMedium,
        labelSmall: labelSmall,
      );
}
