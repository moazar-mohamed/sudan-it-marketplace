import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/arabic_text.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../categories/presentation/category_label.dart';
import 'category_grid_style.dart';

/// "Categories" section of the customer home: a grid of coloured cards, each
/// with an icon and the category name, and a "More" link to the full list.
/// Tapping a card selects that category; tapping the selected one again
/// clears it. Sizes, colours and how many show are set in [style].
class CategoryGrid extends StatelessWidget {
  const CategoryGrid({
    super.key,
    required this.categories,
    required this.selectedId,
    required this.onSelected,
    this.style = CategoryGridStyle.standard,
  });

  final List<Category> categories;
  final String? selectedId;
  final CategoryGridStyle style;

  /// Called with the tapped category's id, or null to clear the selection.
  final ValueChanged<String?> onSelected;

  Future<void> _showAll(BuildContext context) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        maxChildSize: 0.92,
        builder: (_, controller) => SingleChildScrollView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.s16,
            0,
            AppSpacing.s16,
            AppSpacing.s24,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.homeCategoriesTitle,
                style: AppTextStyles.h2,
              ),
              const SizedBox(height: AppSpacing.s12),
              _Tiles(
                categories: categories,
                selectedId: selectedId,
                style: style,
                onTap: (id) => Navigator.of(sheetContext).pop(id),
              ),
            ],
          ),
        ),
      ),
    );
    if (picked != null) {
      onSelected(picked == selectedId ? null : picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) return const SizedBox.shrink();
    final hasMore = categories.length > style.previewCount;
    final preview = categories.take(style.previewCount).toList();
    // A selected category hidden behind "More" still shows as selected.
    if (selectedId != null && !preview.any((c) => c.id == selectedId)) {
      final selected = categories.where((c) => c.id == selectedId);
      if (selected.isNotEmpty) {
        preview
          ..removeLast()
          ..add(selected.first);
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                context.l10n.homeCategoriesTitle,
                style: AppTextStyles.h3,
              ),
            ),
            if (selectedId != null)
              TextButton(
                onPressed: () => onSelected(null),
                child: Text(context.l10n.homeFilterAllCategories),
              ),
            if (hasMore)
              TextButton.icon(
                onPressed: () => _showAll(context),
                icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                iconAlignment: IconAlignment.end,
                label: Text(context.l10n.homeCategoriesMore),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.s8),
        _Tiles(
          categories: preview,
          selectedId: selectedId,
          style: style,
          onTap: (id) => onSelected(id == selectedId ? null : id),
        ),
      ],
    );
  }
}

class _Tiles extends StatelessWidget {
  const _Tiles({
    required this.categories,
    required this.selectedId,
    required this.style,
    required this.onTap,
  });

  final List<Category> categories;
  final String? selectedId;
  final CategoryGridStyle style;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: categories.length,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: style.columns,
        mainAxisSpacing: style.spacing,
        crossAxisSpacing: style.spacing,
        mainAxisExtent: style.tileHeight,
      ),
      itemBuilder: (context, i) {
        final category = categories[i];
        return _Tile(
          category: category,
          selected: category.id == selectedId,
          style: style,
          onTap: () => onTap(category.id),
        );
      },
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.category,
    required this.selected,
    required this.style,
    required this.onTap,
  });

  final Category category;
  final bool selected;
  final CategoryGridStyle style;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final name = category.localizedName(context);
    final icon = categoryIconFor(category);
    final accent = style.colorFor(icon, category.id);
    final brightness = Theme.of(context).brightness;
    const arrowSize = AppSize.iconMd;
    return Semantics(
      button: true,
      selected: selected,
      label: name,
      excludeSemantics: true,
      child: AppCard(
        onTap: onTap,
        color: style.backgroundFor(accent, colors.surface, brightness),
        borderColor:
            selected ? colors.borderFocus : accent.withValues(alpha: 0.18),
        borderWidth: selected ? AppBorder.thick : AppBorder.thin,
        padding: EdgeInsets.all(style.padding),
        child: Stack(
          children: [
            // Room on the right for the arrow, in both languages.
            Padding(
              padding: EdgeInsets.only(
                right: style.showArrow ? arrowSize - AppSpacing.s4 : 0,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: style.iconCircleSize,
                    height: style.iconCircleSize,
                    decoration: BoxDecoration(
                      color: accent,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, size: style.iconSize, color: Colors.white),
                  ),
                  const SizedBox(height: AppSpacing.s6),
                  Flexible(
                    child: _FittedName(
                      name,
                      style: style,
                      textStyle: AppTextStyles.labelMedium.copyWith(
                        color: selected ? colors.textBrand : colors.textPrimary,
                        fontWeight: FontWeight.w600,
                        height: 1.25,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (style.showArrow)
              Positioned(
                right: -AppSpacing.s4,
                top: 0,
                bottom: 0,
                child: Center(
                  child: Icon(
                    Icons.chevron_right_rounded,
                    size: arrowSize,
                    // Always points right, as in the design, even in Arabic.
                    textDirection: TextDirection.ltr,
                    color: selected ? colors.iconBrand : colors.iconMuted,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// A category name that shrinks its font (within the [style]'s limits) until
/// it fits in the allowed lines without breaking a word in the middle.
class _FittedName extends StatelessWidget {
  const _FittedName(this.text, {required this.style, required this.textStyle});

  final String text;
  final CategoryGridStyle style;
  final TextStyle textStyle;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final direction = Directionality.of(context);
        final scaler = MediaQuery.textScalerOf(context);
        // Measure with the font the Text will really use.
        final base = DefaultTextStyle.of(context).style.merge(textStyle);
        final words = text.split(RegExp(r'\s+'));
        bool fits(double size) {
          final sized = base.copyWith(fontSize: size);
          final whole = TextPainter(
            text: TextSpan(text: text, style: sized),
            textDirection: direction,
            textScaler: scaler,
            maxLines: style.nameMaxLines,
          )..layout(maxWidth: constraints.maxWidth);
          final exceeded = whole.didExceedMaxLines;
          whole.dispose();
          if (exceeded) return false;
          // Flutter breaks a word wider than the line mid-word; avoid that.
          for (final word in words) {
            final painter = TextPainter(
              text: TextSpan(text: word, style: sized),
              textDirection: direction,
              textScaler: scaler,
              maxLines: 1,
            )..layout();
            final tooWide = painter.width > constraints.maxWidth;
            painter.dispose();
            if (tooWide) return false;
          }
          return true;
        }

        var size = style.nameMaxFontSize;
        while (size > style.nameMinFontSize && !fits(size)) {
          size -= 0.5;
        }
        return Text(
          text,
          maxLines: style.nameMaxLines,
          overflow: TextOverflow.ellipsis,
          style: textStyle.copyWith(fontSize: size),
        );
      },
    );
  }
}

/// The icon for [category]: the one its `iconName` names, else one guessed
/// from words in its name (Arabic or English), else a generic category icon.
IconData categoryIconFor(Category category) {
  final byName = _iconsByName[normalizeSearchText(category.iconName)];
  if (byName != null) return byName;
  final text = ' ${normalizeSearchText(category.searchText)} ';
  for (final entry in _iconKeywords) {
    for (final keyword in entry.$2) {
      // Latin words match at the start of a word ("ups" is not in "groups");
      // Arabic ones anywhere, so "الطابعات" still finds "طابعات".
      final isLatin = RegExp(r'^[a-z]').hasMatch(keyword);
      if (text.contains(isLatin ? ' $keyword' : keyword)) return entry.$1;
    }
  }
  return Icons.category_outlined;
}

/// Icon names a Platform Admin can type in the category's icon field.
final _iconsByName = <String, IconData>{
  'laptop': Icons.laptop_mac,
  'computer': Icons.desktop_windows_outlined,
  'phone': Icons.smartphone,
  'tablet': Icons.tablet_mac,
  'router': Icons.router_outlined,
  'network': Icons.lan_outlined,
  'wifi': Icons.wifi,
  'camera': Icons.videocam_outlined,
  'cctv': Icons.videocam_outlined,
  'printer': Icons.print_outlined,
  'server': Icons.dns_outlined,
  'storage': Icons.storage_outlined,
  'monitor': Icons.monitor,
  'keyboard': Icons.keyboard_outlined,
  'mouse': Icons.mouse_outlined,
  'headset': Icons.headphones,
  'battery': Icons.battery_charging_full,
  'ups': Icons.power_outlined,
  'cable': Icons.cable,
  'security': Icons.shield_outlined,
  'software': Icons.apps,
  'cloud': Icons.cloud_outlined,
  'service': Icons.design_services_outlined,
  'tools': Icons.build_outlined,
  'game': Icons.sports_esports_outlined,
  'accessory': Icons.usb,
};

/// Words that hint at an icon, checked in order against the category name
/// (already normalized: no diacritics, ة -> ه, lowercase).
final _iconKeywords = <(IconData, List<String>)>[
  (Icons.laptop_mac, ['laptop', 'notebook', 'لابتوب', 'لاب توب']),
  (Icons.desktop_windows_outlined, ['computer', 'desktop', 'كمبيوتر', 'حاسوب', 'حاسب']),
  (Icons.smartphone, ['phone', 'mobile', 'موبايل', 'هاتف', 'جوال', 'تلفون']),
  (Icons.tablet_mac, ['tablet', 'تابلت']),
  (Icons.router_outlined, ['router', 'telecom', 'راوتر', 'روتر', 'اتصالات']),
  (Icons.wifi, ['wifi', 'wi-fi', 'wireless', 'واي فاي', 'وايفاي', 'لاسلكي']),
  (Icons.lan_outlined, ['network', 'switch', 'شبكه', 'شبكات', 'سويتش']),
  (Icons.videocam_outlined, ['camera', 'cctv', 'كاميرا', 'كاميرات', 'مراقبه']),
  (Icons.print_outlined, ['printer', 'طابعه', 'طابعات']),
  (Icons.dns_outlined, ['server', 'سيرفر', 'خادم', 'خوادم']),
  (Icons.storage_outlined, ['storage', 'hard', 'ssd', 'تخزين', 'هارد', 'قرص']),
  (Icons.monitor, ['monitor', 'screen', 'display', 'شاشه', 'شاشات']),
  (Icons.keyboard_outlined, ['keyboard', 'كيبورد', 'لوحه مفاتيح']),
  (Icons.mouse_outlined, ['mouse', 'ماوس']),
  (Icons.headphones, ['headset', 'headphone', 'سماعه', 'سماعات']),
  (Icons.power_outlined, ['ups', 'power', 'طاقه', 'يو بي اس']),
  (Icons.battery_charging_full, ['battery', 'charger', 'بطاريه', 'شاحن']),
  (Icons.cable, ['cable', 'كيبل', 'كابل', 'كوابل']),
  (Icons.shield_outlined, ['security', 'cyber', 'firewall', 'antivirus', 'امن', 'حمايه', 'فايروول']),
  (Icons.apps, ['software', 'برنامج', 'برمجيات']),
  (Icons.cloud_outlined, ['cloud', 'سحاب']),
  (Icons.sports_esports_outlined, ['game', 'gaming', 'العاب']),
  (Icons.design_services_outlined, ['service', 'خدمه', 'خدمات', 'installation', 'تركيب', 'صيانه', 'maintenance']),
];
