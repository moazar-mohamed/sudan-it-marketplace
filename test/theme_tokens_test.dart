import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sudan_it_marketplace/core/theme/app_colors.dart';
import 'package:sudan_it_marketplace/core/theme/app_dimensions.dart';
import 'package:sudan_it_marketplace/core/theme/app_text_styles.dart';
import 'package:sudan_it_marketplace/core/theme/app_theme.dart';

/// WCAG 2.1 contrast ratio between two opaque colours.
double contrast(Color a, Color b) {
  final l1 = a.computeLuminance();
  final l2 = b.computeLuminance();
  final hi = l1 > l2 ? l1 : l2;
  final lo = l1 > l2 ? l2 : l1;
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  group('brand identity', () {
    test('primary and secondary colours never change', () {
      expect(AppColors.primary, const Color(0xFF1565C0));
      expect(AppColors.secondary, const Color(0xFF00A8E8));
      expect(AppColors.background, const Color(0xFFF7F9FC));
      expect(AppColors.text, const Color(0xFF172033));
    });

    test('the theme is built on them', () {
      final scheme = AppTheme.light.colorScheme;
      expect(scheme.primary, AppColors.primary);
      expect(scheme.secondary, AppColors.secondary);
      expect(AppTheme.light.appBarTheme.backgroundColor, AppColors.primary);
    });
  });

  group('accessibility (WCAG AA)', () {
    test('text tokens reach 4.5:1 on the surfaces they are used on', () {
      final pairs = <String, (Color, Color)>{
        'primary on app bg': (AppColors.textPrimary, AppColors.bgApp),
        'primary on surface': (AppColors.textPrimary, AppColors.bgSurface),
        'secondary on surface': (AppColors.textSecondary, AppColors.bgSurface),
        'secondary on muted': (AppColors.textSecondary, AppColors.bgMuted),
        'secondary on subtle': (AppColors.textSecondary, AppColors.bgSubtle),
        'tertiary on surface': (AppColors.textTertiary, AppColors.bgSurface),
        'on primary': (AppColors.textOnPrimary, AppColors.primary),
        'on primary pressed':
            (AppColors.textOnPrimary, AppColors.brandPrimaryPressed),
        'on error': (AppColors.textOnPrimary, AppColors.error),
        'brand on surface': (AppColors.textBrand, AppColors.bgSurface),
        'brand on subtle': (AppColors.textBrand, AppColors.brandPrimarySubtle),
        'inverse on inverse': (AppColors.textInverse, AppColors.bgInverse),
      };
      for (final entry in pairs.entries) {
        expect(
          contrast(entry.value.$1, entry.value.$2),
          greaterThanOrEqualTo(4.5),
          reason: entry.key,
        );
      }
    });

    test('every tone is readable: foreground on its tinted background', () {
      for (final tone in AppTone.values) {
        expect(
          contrast(tone.foreground, tone.background),
          greaterThanOrEqualTo(4.5),
          reason: tone.name,
        );
      }
    });

    test('control borders and muted icons reach 3:1 on the surface', () {
      for (final color in [
        AppColors.borderInput,
        AppColors.borderStrong,
        AppColors.borderFocus,
        AppColors.iconMuted,
      ]) {
        expect(
          contrast(color, AppColors.bgSurface),
          greaterThanOrEqualTo(3.0),
        );
      }
    });
  });

  group('typography', () {
    test('one family, Cairo, on every text role', () {
      final textTheme = AppTheme.light.textTheme;
      for (final style in [
        textTheme.headlineLarge,
        textTheme.headlineSmall,
        textTheme.titleLarge,
        textTheme.titleMedium,
        textTheme.titleSmall,
        textTheme.bodyLarge,
        textTheme.bodyMedium,
        textTheme.bodySmall,
        textTheme.labelLarge,
        textTheme.labelMedium,
        textTheme.labelSmall,
      ]) {
        expect(style?.fontFamily, AppFonts.family);
      }
    });

    test('roles follow the Figma type ramp (size / line height)', () {
      final t = AppTheme.light.textTheme;
      expect((t.headlineSmall!.fontSize, t.headlineSmall!.height), (24, 34 / 24));
      expect((t.titleLarge!.fontSize, t.titleLarge!.height), (20, 30 / 20));
      expect((t.titleSmall!.fontSize, t.titleSmall!.height), (14, 22 / 14));
      expect((t.bodyMedium!.fontSize, t.bodyMedium!.height), (14, 22 / 14));
      expect((t.bodySmall!.fontSize, t.bodySmall!.height), (12, 18 / 12));
      expect(t.titleSmall!.fontWeight, FontWeight.w600);
    });
  });

  group('component defaults', () {
    final theme = AppTheme.light;

    test('buttons and inputs are 48 high with an 8 px radius', () {
      final style = theme.filledButtonTheme.style!;
      expect(style.minimumSize!.resolve({}), const Size(64, 48));
      final shape = style.shape!.resolve({}) as RoundedRectangleBorder;
      expect(shape.borderRadius, BorderRadius.circular(AppRadius.sm));
      final border = theme.inputDecorationTheme.enabledBorder as OutlineInputBorder;
      expect(border.borderRadius, BorderRadius.circular(AppRadius.sm));
      expect(border.borderSide.color, AppColors.borderInput);
    });

    test('a disabled button is flat gray, never a faded brand colour', () {
      final style = theme.elevatedButtonTheme.style!;
      expect(
        style.backgroundColor!.resolve({WidgetState.disabled}),
        AppColors.disabledBg,
      );
      expect(
        style.foregroundColor!.resolve({WidgetState.disabled}),
        AppColors.disabledFg,
      );
    });

    test('cards are bordered 12 px, dialogs 16 px, bottom bar 72 high', () {
      final card = theme.cardTheme.shape! as RoundedRectangleBorder;
      expect(card.borderRadius, BorderRadius.circular(AppRadius.md));
      expect(card.side.color, AppColors.borderDefault);
      final dialog = theme.dialogTheme.shape! as RoundedRectangleBorder;
      expect(dialog.borderRadius, BorderRadius.circular(AppRadius.lg));
      expect(theme.navigationBarTheme.height, AppSize.bottomNav);
    });
  });
}
