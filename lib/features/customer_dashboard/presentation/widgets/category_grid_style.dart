import 'package:flutter/material.dart';

import '../../../categories/domain/entities/category.dart';

/// How the categories are laid out: coloured cards in rows, or one sideways
/// row of soft square tiles with the name underneath.
enum CategoryLayout { grid, row }

/// Every setting of the home screen's category cards, in one place. Change a
/// value here and every category grid (home and the "More" sheet) follows.
class CategoryGridStyle {
  const CategoryGridStyle({
    this.previewCount = 9,
    this.columns = 3,
    this.tileHeight = 122,
    this.spacing = 12,
    this.padding = 10,
    this.iconCircleSize = 40,
    this.iconSize = 22,
    this.nameMaxFontSize = 12.5,
    this.nameMinFontSize = 9,
    this.nameMaxLines = 2,
    this.showArrow = true,
    this.palette = defaultPalette,
    this.lightTint = 0.10,
    this.darkTint = 0.20,
    this.layout = CategoryLayout.grid,
    this.rowTileSize = 68,
    this.rowItemWidth = 80,
  }) : assert(previewCount > 0),
       assert(columns > 0),
       assert(nameMinFontSize <= nameMaxFontSize);

  /// The style the app uses.
  static const standard = CategoryGridStyle();

  /// The home screen's sideways row of tiles (the cards of [standard] still
  /// fill the "View all" sheet).
  static const homeRow = CategoryGridStyle(
    layout: CategoryLayout.row,
    lightTint: 0.12,
    darkTint: 0.22,
  );

  /// How many categories show on the home screen before "More". Any number
  /// works; a multiple of [columns] keeps the last row full.
  final int previewCount;

  /// Cards per row.
  final int columns;

  /// Card height. Wider phones get wider cards, not taller ones.
  final double tileHeight;

  /// Gap between cards, across and down.
  final double spacing;

  /// Space inside each card.
  final double padding;

  /// The coloured circle behind the icon, and the icon inside it.
  final double iconCircleSize;
  final double iconSize;

  /// The name starts at [nameMaxFontSize] and shrinks, down to
  /// [nameMinFontSize], until it fits in [nameMaxLines] without breaking a
  /// word; only then is it cut with "…".
  final double nameMaxFontSize;
  final double nameMinFontSize;
  final int nameMaxLines;

  /// The small arrow on the right of each card.
  final bool showArrow;

  /// The colours categories take. A category gets one by its icon (see
  /// [paletteIndexByIcon]); others get one from their id, so it never changes.
  final List<Color> palette;

  /// How strongly the card background is tinted with its colour, in light
  /// and in dark mode (0 = plain card, 1 = the full colour).
  final double lightTint;
  final double darkTint;

  /// [CategoryLayout.row] only: the size of the square tile, and the width
  /// each tile and its name take in the row.
  final CategoryLayout layout;
  final double rowTileSize;
  final double rowItemWidth;

  static const defaultPalette = <Color>[
    Color(0xFF1E6FD9), // 0 blue
    Color(0xFF16A34A), // 1 green
    Color(0xFF9333EA), // 2 purple
    Color(0xFFE11D48), // 3 red
    Color(0xFF4F46E5), // 4 indigo
    Color(0xFFF59E0B), // 5 amber
    Color(0xFF0D9488), // 6 teal
    Color(0xFF0284C7), // 7 sky
    Color(0xFFF97316), // 8 orange
    Color(0xFFDB2777), // 9 pink
  ];

  /// The name Platform Admin stores for each [defaultPalette] colour, in the
  /// same order, so a category can pick its colour by name.
  static const paletteNames = <String>[
    'blue',
    'green',
    'purple',
    'red',
    'indigo',
    'amber',
    'teal',
    'sky',
    'orange',
    'pink',
  ];

  /// Which [palette] colour goes with each icon, so similar categories look
  /// alike (security is red, power is orange, …). An index past the end of
  /// [palette] wraps around.
  static final paletteIndexByIcon = <IconData, int>{
    Icons.laptop_mac: 0,
    Icons.desktop_windows_outlined: 0,
    Icons.monitor: 0,
    Icons.keyboard_outlined: 0,
    Icons.mouse_outlined: 0,
    Icons.usb: 0,
    Icons.lan_outlined: 1,
    Icons.cable: 1,
    Icons.wifi: 1,
    Icons.router_outlined: 2,
    Icons.headphones: 2,
    Icons.shield_outlined: 3,
    Icons.dns_outlined: 4,
    Icons.storage_outlined: 4,
    Icons.print_outlined: 4,
    Icons.apps: 5,
    Icons.design_services_outlined: 6,
    Icons.build_outlined: 6,
    Icons.cloud_outlined: 7,
    Icons.videocam_outlined: 7,
    Icons.power_outlined: 8,
    Icons.battery_charging_full: 8,
    Icons.smartphone: 9,
    Icons.tablet_mac: 9,
    Icons.sports_esports_outlined: 9,
  };

  /// The colour of [category]: the one Platform Admin picked, else the one its
  /// [icon] goes with.
  Color colorOfCategory(Category category, IconData icon) {
    final named = paletteNames.indexOf(category.colorName.trim().toLowerCase());
    return named >= 0
        ? palette[named % palette.length]
        : colorFor(icon, category.id);
  }

  /// The colour of a category with [icon] and [id].
  Color colorFor(IconData icon, String id) {
    final index = paletteIndexByIcon[icon] ?? _stableHash(id);
    return palette[index % palette.length];
  }

  /// The card background for [color] in the current [brightness].
  Color backgroundFor(Color color, Color surface, Brightness brightness) =>
      Color.alphaBlend(
        color.withValues(
          alpha: brightness == Brightness.dark ? darkTint : lightTint,
        ),
        surface,
      );
}

/// Same number for the same text on every device and every run (unlike
/// [String.hashCode]), so a category keeps its colour.
int _stableHash(String text) {
  var hash = 0;
  for (final unit in text.codeUnits) {
    hash = (hash * 31 + unit) & 0x7fffffff;
  }
  return hash;
}
