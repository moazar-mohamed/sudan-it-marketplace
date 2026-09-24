import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';
import 'app_dimensions.dart';
import 'app_text_styles.dart';

/// The app theme, built from the design tokens (Figma: "Sudan ICT Marketplace
/// — Design System & Product UI"). Extends the original theme rather than
/// replacing it: same colour scheme entry points, same `AppTheme.light`.
class AppTheme {
  AppTheme._();

  static ThemeData get light {
    const colorScheme = ColorScheme.light(
      primary: AppColors.primary,
      onPrimary: AppColors.onPrimary,
      primaryContainer: AppColors.brandPrimarySubtle,
      onPrimaryContainer: AppColors.brandPrimaryPressed,
      secondary: AppColors.secondary,
      onSecondary: AppColors.onPrimary,
      secondaryContainer: AppColors.brandSecondarySubtle,
      onSecondaryContainer: AppColors.borderFocusRing,
      error: AppColors.error,
      onError: AppColors.onPrimary,
      errorContainer: AppColors.errorSubtle,
      onErrorContainer: AppColors.errorText,
      surface: AppColors.surface,
      onSurface: AppColors.text,
      onSurfaceVariant: AppColors.textSecondary,
      surfaceContainerLowest: AppColors.surface,
      surfaceContainerLow: AppColors.bgApp,
      surfaceContainer: AppColors.bgSubtle,
      surfaceContainerHigh: AppColors.bgMuted,
      surfaceContainerHighest: AppColors.bgMuted,
      outline: AppColors.borderInput,
      outlineVariant: AppColors.borderDefault,
      inverseSurface: AppColors.bgInverse,
      onInverseSurface: AppColors.textInverse,
      inversePrimary: AppColors.brandSecondary,
      scrim: AppColors.bgScrim,
      shadow: AppColors.bgInverse,
      surfaceTint: Colors.transparent,
    );

    final textTheme = AppTextStyles.textTheme;

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
              ? AppColors.brandPrimaryPressed
              : s.contains(WidgetState.hovered)
                  ? AppColors.brandPrimaryHover
                  : AppColors.primary,
          AppColors.disabledBg,
        ),
      ),
      foregroundColor: WidgetStateProperty.resolveWith(
        (s) => disabledOr(s, AppColors.onPrimary, AppColors.disabledFg),
      ),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      side: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.focused)
            ? const BorderSide(color: AppColors.borderFocusRing, width: 2)
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
        (s) => disabledOr(s, AppColors.textBrand, AppColors.disabledFg),
      ),
      backgroundColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.pressed)
            ? AppColors.brandPrimarySubtleStrong
            : s.contains(WidgetState.hovered)
                ? AppColors.brandPrimarySubtle
                : AppColors.surface,
      ),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      side: WidgetStateProperty.resolveWith((s) {
        if (s.contains(WidgetState.disabled)) return AppBorder.card;
        if (s.contains(WidgetState.focused)) {
          return const BorderSide(color: AppColors.borderFocus, width: 2);
        }
        return AppBorder.input;
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
        (s) => disabledOr(s, AppColors.textBrand, AppColors.disabledFg),
      ),
      backgroundColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.pressed)
            ? AppColors.brandPrimarySubtleStrong
            : s.contains(WidgetState.hovered)
                ? AppColors.brandPrimarySubtle
                : Colors.transparent,
      ),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      side: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.focused)
            ? const BorderSide(color: AppColors.borderFocus, width: 2)
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
      scaffoldBackgroundColor: AppColors.bgApp,
      iconTheme: const IconThemeData(color: AppColors.iconDefault),
      dividerTheme: const DividerThemeData(
        color: AppColors.borderDefault,
        thickness: 1,
        space: 1,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        toolbarHeight: AppSize.appBar,
        iconTheme: const IconThemeData(color: AppColors.onPrimary),
        actionsIconTheme: const IconThemeData(color: AppColors.onPrimary),
        titleTextStyle: AppTextStyles.h2.copyWith(color: AppColors.onPrimary),
        systemOverlayStyle: SystemUiOverlayStyle.light,
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
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s12,
          vertical: AppSpacing.s12,
        ),
        hintStyle: AppTextStyles.body.copyWith(color: AppColors.textTertiary),
        labelStyle: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
        floatingLabelStyle:
            AppTextStyles.labelLarge.copyWith(color: AppColors.textBrand),
        helperStyle:
            AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
        errorStyle: AppTextStyles.caption.copyWith(color: AppColors.errorText),
        prefixIconColor: AppColors.iconMuted,
        suffixIconColor: AppColors.iconMuted,
        border: inputBorder(AppColors.borderInput),
        enabledBorder: inputBorder(AppColors.borderInput),
        focusedBorder: inputBorder(AppColors.borderFocus, 2),
        errorBorder: inputBorder(AppColors.borderError, 2),
        focusedErrorBorder: inputBorder(AppColors.borderError, 2),
        disabledBorder: inputBorder(AppColors.borderDefault),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.mdAll,
          side: AppBorder.card,
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 6,
        shadowColor: AppColors.bgScrim,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
        titleTextStyle: AppTextStyles.h3,
        contentTextStyle:
            AppTextStyles.body.copyWith(color: AppColors.textSecondary),
        actionsPadding: const EdgeInsets.fromLTRB(
          AppSpacing.s24,
          0,
          AppSpacing.s16,
          AppSpacing.s16,
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.surface,
        modalBarrierColor: AppColors.bgScrim,
        showDragHandle: true,
        dragHandleColor: AppColors.borderStrong,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.sheetTop),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: AppSize.bottomNav,
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        indicatorColor: AppColors.brandPrimarySubtle,
        indicatorShape: const StadiumBorder(),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? AppTextStyles.captionStrong.copyWith(color: AppColors.textBrand)
              : AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(
            size: 24,
            color: s.contains(WidgetState.selected)
                ? AppColors.iconBrand
                : AppColors.iconMuted,
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surface,
        selectedColor: AppColors.brandPrimarySubtle,
        disabledColor: AppColors.bgSubtle,
        checkmarkColor: AppColors.primary,
        labelStyle: AppTextStyles.labelLarge,
        secondaryLabelStyle:
            AppTextStyles.labelLarge.copyWith(color: AppColors.textBrand),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s4),
        side: AppBorder.input,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.smAll),
        showCheckmark: true,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.bgInverse,
        contentTextStyle:
            AppTextStyles.body.copyWith(color: AppColors.textInverse),
        actionTextColor: AppColors.brandSecondary,
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
          side: const WidgetStatePropertyAll(
            BorderSide(color: AppColors.borderInput),
          ),
          backgroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected)
                ? AppColors.primary
                : AppColors.surface,
          ),
          foregroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected)
                ? AppColors.onPrimary
                : AppColors.textPrimary,
          ),
        ),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: AppColors.textBrand,
        unselectedLabelColor: AppColors.textSecondary,
        labelStyle: AppTextStyles.labelLarge,
        unselectedLabelStyle: AppTextStyles.labelLarge,
        indicatorColor: AppColors.primary,
        dividerColor: AppColors.borderDefault,
        indicatorSize: TabBarIndicatorSize.tab,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: const WidgetStatePropertyAll(Colors.white),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.disabled)
              ? AppColors.disabledBg
              : s.contains(WidgetState.selected)
                  ? AppColors.primary
                  : AppColors.borderStrong,
        ),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(borderRadius: AppRadius.xsAll),
        side: const BorderSide(color: AppColors.borderStrong, width: 2),
        fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? (s.contains(WidgetState.disabled)
                  ? AppColors.disabledBg
                  : AppColors.primary)
              : Colors.transparent,
        ),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? AppColors.primary
              : AppColors.borderStrong,
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
        circularTrackColor: AppColors.brandPrimarySubtle,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 6,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        textStyle: AppTextStyles.body,
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: AppColors.iconDefault,
        textColor: AppColors.textPrimary,
        selectedColor: AppColors.primary,
      ),
      textSelectionTheme: const TextSelectionThemeData(
        cursorColor: AppColors.primary,
        selectionColor: AppColors.brandPrimarySubtleStrong,
        selectionHandleColor: AppColors.primary,
      ),
    );
  }
}
