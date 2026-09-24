import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Spacing scale (Figma collection Space). Use the smaller values inside a
/// component and the larger ones between sections.
class AppSpacing {
  AppSpacing._();

  static const double s0 = 0;
  static const double s2 = 2;
  static const double s4 = 4;
  static const double s6 = 6;
  static const double s8 = 8;
  static const double s12 = 12;
  static const double s16 = 16;
  static const double s20 = 20;
  static const double s24 = 24;
  static const double s32 = 32;
  static const double s40 = 40;
  static const double s48 = 48;
  static const double s64 = 64;

  /// Side margin of a screen by width: 16 on phones, 24 on tablets, 32 on
  /// desktop (Figma: "Layout grids").
  static double screenMargin(double width) {
    if (width >= 1024) return s32;
    if (width >= 600) return s24;
    return s16;
  }
}

/// Corner radii (Figma collection Radius). Buttons, inputs and chips are 8,
/// cards 12, dialogs and sheets 16; only avatars and switches are round.
class AppRadius {
  AppRadius._();

  static const double none = 0;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double full = 999;

  static BorderRadius get xsAll => BorderRadius.circular(xs);
  static BorderRadius get smAll => BorderRadius.circular(sm);
  static BorderRadius get mdAll => BorderRadius.circular(md);
  static BorderRadius get lgAll => BorderRadius.circular(lg);
  static BorderRadius get fullAll => BorderRadius.circular(full);
  static const BorderRadius sheetTop =
      BorderRadius.vertical(top: Radius.circular(lg));
}

/// Component sizes (Figma collection Size).
class AppSize {
  AppSize._();

  static const double controlSm = 32;
  static const double controlMd = 40;
  static const double controlLg = 48;
  static const double iconSm = 16;
  static const double iconMd = 20;
  static const double iconLg = 24;
  static const double iconXl = 32;
  static const double avatarSm = 32;
  static const double avatarMd = 40;
  static const double avatarLg = 56;
  static const double appBar = 56;
  static const double bottomNav = 72;
  static const double thumb = 52;
  static const double touchMin = 48;
  static const double contentMax = 1200;

  /// Width of a centered reading column on large screens.
  static const double readingMax = 720;
}

/// Border widths (Figma collection Border).
class AppBorder {
  AppBorder._();

  static const double thin = 1;
  static const double thick = 2;

  static BorderSide get card =>
      const BorderSide(color: AppColors.borderDefault, width: thin);
  static BorderSide get input =>
      const BorderSide(color: AppColors.borderInput, width: thin);
}

/// Elevation styles (Figma effect styles). Cards rely on a 1 px border, not
/// shadow; shadows are reserved for things that float above content.
class AppShadows {
  AppShadows._();

  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x0F172033), blurRadius: 2, offset: Offset(0, 1)),
  ];
  static const List<BoxShadow> raised = [
    BoxShadow(color: Color(0x14172033), blurRadius: 12, offset: Offset(0, 4)),
  ];
  static const List<BoxShadow> overlay = [
    BoxShadow(color: Color(0x24172033), blurRadius: 32, offset: Offset(0, 12)),
    BoxShadow(color: Color(0x0F172033), blurRadius: 6, offset: Offset(0, 2)),
  ];

  /// Colour used to draw the 2 px keyboard-focus ring outside a button.
  static const Color focusRing = AppColors.borderFocusRing;
}

/// Motion durations (Figma: "Motion").
class AppMotion {
  AppMotion._();

  static const Duration state = Duration(milliseconds: 150);
  static const Duration overlay = Duration(milliseconds: 200);
}
