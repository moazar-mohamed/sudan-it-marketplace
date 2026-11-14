import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';
import 'app_dimensions.dart';
import 'app_text_styles.dart';

/// The app theme, built from the design tokens (Figma: "Sudan ICT Marketplace
/// — Design System & Product UI"). [light] and [dark] are the same recipe
/// applied to [AppColorTokens.light] and [AppColorTokens.dark].
class AppTheme {
  AppTheme._();

  static final ThemeData light = _build(AppColorTokens.light, Brightness.light);
  static final ThemeData dark = _build(AppColorTokens.dark, Brightness.dark);

  static ThemeData _build(AppColorTokens tokens, Brightness brightness) {
    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: tokens.primary,
      onPrimary: tokens.onPrimary,
      primaryContainer: tokens.brandPrimarySubtle,
      onPrimaryContainer: tokens.infoText,
      secondary: tokens.secondary,
      onSecondary: tokens.onPrimary,
      secondaryContainer: tokens.brandSecondarySubtle,
      onSecondaryContainer: tokens.borderFocusRing,
      error: tokens.error,
      onError: tokens.onPrimary,
      errorContainer: tokens.errorSubtle,
      onErrorContainer: tokens.errorText,
      surface: tokens.surface,
      onSurface: tokens.text,
      onSurfaceVariant: tokens.textSecondary,
      surfaceContainerLowest: tokens.surface,
      surfaceContainerLow: tokens.bgApp,
      surfaceContainer: tokens.bgSubtle,
      surfaceContainerHigh: tokens.bgMuted,
      surfaceContainerHighest: tokens.bgMuted,
      outline: tokens.borderInput,
      outlineVariant: tokens.borderDefault,
      inverseSurface: tokens.bgInverse,
      onInverseSurface: tokens.textInverse,
      inversePrimary: tokens.brandSecondary,
      scrim: tokens.bgScrim,
      shadow: tokens.bgInverse,
      surfaceTint: Colors.transparent,
    );

    final textTheme = AppTextStyles.textTheme;

    // A full brand-blue bar glares on a dark screen, so dark mode uses the
    // raised surface for the bar; the brand blue stays on buttons and accents.
    final isDark = brightness == Brightness.dark;
    final appBarBackground = isDark ? tokens.bgSurface : tokens.primary;
    final appBarForeground = isDark ? tokens.textPrimary : tokens.onPrimary;

    // Disabled controls use flat gray fill with gray text instead of a faded
    // brand colour, so a disabled button never looks half-active.
    Color? disabledOr(Set<WidgetState> states, Color enabled, Color disabled) =>
        states.contains(WidgetState.disabled) ? disabled : enabled;

    final filledStyle = ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(Size(64, AppSize.controlLg)),
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: AppSpacing.s20),
      ),
      shape: WidgetStatePropertyAll(
        RoundedRectangleBorder(borderRadius: AppRadius.smAll),
      ),
      elevation: const WidgetStatePropertyAll(0),
      textStyle: WidgetStatePropertyAll(AppTextStyles.buttonLarge),
      backgroundColor: WidgetStateProperty.resolveWith(
        (s) => disabledOr(
          s,
          s.contains(WidgetState.pressed)
              ? tokens.brandPrimaryPressed
              : s.contains(WidgetState.hovered)
                  ? tokens.brandPrimaryHover
                  : tokens.primary,
          tokens.disabledBg,
        ),
      ),
      foregroundColor: WidgetStateProperty.resolveWith(
        (s) => disabledOr(s, tokens.onPrimary, tokens.disabledFg),
      ),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      side: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.focused)
            ? BorderSide(color: tokens.borderFocusRing, width: 2)
            : BorderSide.none,
      ),
    );

    final outlinedStyle = ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(Size(64, AppSize.controlLg)),
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: AppSpacing.s20),
      ),
      shape: WidgetStatePropertyAll(
        RoundedRectangleBorder(borderRadius: AppRadius.smAll),
      ),
      textStyle: WidgetStatePropertyAll(AppTextStyles.buttonLarge),
      foregroundColor: WidgetStateProperty.resolveWith(
        (s) => disabledOr(s, tokens.textBrand, tokens.disabledFg),
      ),
      backgroundColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.pressed)
            ? tokens.brandPrimarySubtleStrong
            : s.contains(WidgetState.hovered)
                ? tokens.brandPrimarySubtle
                : tokens.surface,
      ),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      side: WidgetStateProperty.resolveWith((s) {
        if (s.contains(WidgetState.disabled)) return AppBorder.card(tokens);
        if (s.contains(WidgetState.focused)) {
          return BorderSide(color: tokens.borderFocus, width: 2);
        }
        return AppBorder.input(tokens);
      }),
    );

    final textButtonStyle = ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(Size(48, AppSize.controlMd)),
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: AppSpacing.s12),
      ),
      shape: WidgetStatePropertyAll(
        RoundedRectangleBorder(borderRadius: AppRadius.smAll),
      ),
      textStyle: WidgetStatePropertyAll(AppTextStyles.buttonMedium),
      foregroundColor: WidgetStateProperty.resolveWith(
        (s) => disabledOr(s, tokens.textBrand, tokens.disabledFg),
      ),
      backgroundColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.pressed)
            ? tokens.brandPrimarySubtleStrong
            : s.contains(WidgetState.hovered)
                ? tokens.brandPrimarySubtle
                : Colors.transparent,
      ),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      side: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.focused)
            ? BorderSide(color: tokens.borderFocus, width: 2)
            : BorderSide.none,
      ),
    );

    OutlineInputBorder inputBorder(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: AppRadius.smAll,
          borderSide: BorderSide(color: color, width: width),
        );

    return ThemeData(
      useMaterial3: true,
      fontFamily: AppFonts.family,
      colorScheme: colorScheme,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      extensions: [tokens],
      scaffoldBackgroundColor: tokens.bgApp,
      iconTheme: IconThemeData(color: tokens.iconDefault),
      dividerTheme: DividerThemeData(
        color: tokens.borderDefault,
        thickness: 1,
        space: 1,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: appBarBackground,
        foregroundColor: appBarForeground,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        toolbarHeight: AppSize.appBar,
        iconTheme: IconThemeData(color: appBarForeground),
        actionsIconTheme: IconThemeData(color: appBarForeground),
        titleTextStyle: AppTextStyles.h2.copyWith(color: appBarForeground),
        // White status-bar icons on both: the blue bar and the dark surface.
        systemOverlayStyle: SystemUiOverlayStyle.light,
        shape: isDark
            ? Border(bottom: BorderSide(color: tokens.borderDefault))
            : null,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(style: filledStyle),
      filledButtonTheme: FilledButtonThemeData(style: filledStyle),
      outlinedButtonTheme: OutlinedButtonThemeData(style: outlinedStyle),
      textButtonTheme: TextButtonThemeData(style: textButtonStyle),
      // No icon colour here on purpose: an IconButton takes its colour from the
      // surrounding IconTheme, so it is white in the blue app bar and dark ink
      // elsewhere.
      iconButtonTheme: const IconButtonThemeData(
        style: ButtonStyle(
          minimumSize: WidgetStatePropertyAll(
            Size(AppSize.controlMd, AppSize.controlMd),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: tokens.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s12,
          vertical: AppSpacing.s12,
        ),
        hintStyle: AppTextStyles.body.copyWith(color: tokens.textTertiary),
        labelStyle: AppTextStyles.body.copyWith(color: tokens.textSecondary),
        floatingLabelStyle:
            AppTextStyles.labelLarge.copyWith(color: tokens.textBrand),
        helperStyle:
            AppTextStyles.caption.copyWith(color: tokens.textSecondary),
        errorStyle: AppTextStyles.caption.copyWith(color: tokens.errorText),
        prefixIconColor: tokens.iconMuted,
        suffixIconColor: tokens.iconMuted,
        border: inputBorder(tokens.borderInput),
        enabledBorder: inputBorder(tokens.borderInput),
        focusedBorder: inputBorder(tokens.borderFocus, 2),
        errorBorder: inputBorder(tokens.borderError, 2),
        focusedErrorBorder: inputBorder(tokens.borderError, 2),
        disabledBorder: inputBorder(tokens.borderDefault),
      ),
      cardTheme: CardThemeData(
        color: tokens.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.mdAll,
          side: AppBorder.card(tokens),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: tokens.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 6,
        shadowColor: tokens.bgScrim,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
        titleTextStyle: AppTextStyles.h3,
        contentTextStyle:
            AppTextStyles.body.copyWith(color: tokens.textSecondary),
        actionsPadding: const EdgeInsets.fromLTRB(
          AppSpacing.s24,
          0,
          AppSpacing.s16,
          AppSpacing.s16,
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: tokens.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: tokens.surface,
        modalBarrierColor: tokens.bgScrim,
        showDragHandle: true,
        dragHandleColor: tokens.borderStrong,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.sheetTop),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: AppSize.bottomNav,
        backgroundColor: tokens.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        indicatorColor: tokens.brandPrimarySubtle,
        indicatorShape: const StadiumBorder(),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? AppTextStyles.captionStrong.copyWith(color: tokens.textBrand)
              : AppTextStyles.caption.copyWith(color: tokens.textSecondary),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(
            size: 24,
            color: s.contains(WidgetState.selected)
                ? tokens.iconBrand
                : tokens.iconMuted,
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: tokens.surface,
        selectedColor: tokens.brandPrimarySubtle,
        disabledColor: tokens.bgSubtle,
        checkmarkColor: tokens.iconBrand,
        // A chip's label does not inherit the ambient text colour: with no
        // colour here Flutter paints it white, invisible on a white chip.
        labelStyle: AppTextStyles.labelLarge.copyWith(
          color: WidgetStateColor.resolveWith(
            (states) => states.contains(WidgetState.disabled)
                ? tokens.disabledFg
                : states.contains(WidgetState.selected)
                    ? tokens.textBrand
                    : tokens.textPrimary,
          ),
        ),
        secondaryLabelStyle:
            AppTextStyles.labelLarge.copyWith(color: tokens.textBrand),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s4),
        side: AppBorder.input(tokens),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.smAll),
        showCheckmark: true,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: tokens.bgInverse,
        contentTextStyle:
            AppTextStyles.body.copyWith(color: tokens.textInverse),
        actionTextColor: tokens.brandSecondary,
        behavior: SnackBarBehavior.floating,
        elevation: 4,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.smAll),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(
            Size(AppSize.controlMd, AppSize.controlMd),
          ),
          textStyle: WidgetStatePropertyAll(AppTextStyles.buttonMedium),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadius.smAll),
          ),
          side: WidgetStatePropertyAll(
            BorderSide(color: tokens.borderInput),
          ),
          backgroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected)
                ? tokens.primary
                : tokens.surface,
          ),
          foregroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected)
                ? tokens.onPrimary
                : tokens.textPrimary,
          ),
        ),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: tokens.textBrand,
        unselectedLabelColor: tokens.textSecondary,
        labelStyle: AppTextStyles.labelLarge,
        unselectedLabelStyle: AppTextStyles.labelLarge,
        indicatorColor: tokens.iconBrand,
        dividerColor: tokens.borderDefault,
        indicatorSize: TabBarIndicatorSize.tab,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: const WidgetStatePropertyAll(Colors.white),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.disabled)
              ? tokens.disabledBg
              : s.contains(WidgetState.selected)
                  ? tokens.primary
                  : tokens.borderStrong,
        ),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(borderRadius: AppRadius.xsAll),
        side: BorderSide(color: tokens.borderStrong, width: 2),
        fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? (s.contains(WidgetState.disabled)
                  ? tokens.disabledBg
                  : tokens.primary)
              : Colors.transparent,
        ),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? tokens.iconBrand
              : tokens.borderStrong,
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: tokens.iconBrand,
        circularTrackColor: tokens.brandPrimarySubtle,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: tokens.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 6,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        textStyle: AppTextStyles.body,
      ),
      listTileTheme: ListTileThemeData(
        iconColor: tokens.iconDefault,
        textColor: tokens.textPrimary,
        selectedColor: tokens.textBrand,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: tokens.iconBrand,
        selectionColor: tokens.brandPrimarySubtleStrong,
        selectionHandleColor: tokens.iconBrand,
      ),
    );
  }
}
