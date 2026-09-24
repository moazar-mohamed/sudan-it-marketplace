import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/arabic_text.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../categories/presentation/category_label.dart';

/// How many category tiles show on the home screen before "More".
const categoryGridPreviewCount = 8;

/// "Categories" section of the customer home: a grid of tiles, each with an
/// icon and the category name, and a "More" link to the full list. Tapping a
/// tile selects that category; tapping the selected one again clears it.
class CategoryGrid extends StatelessWidget {
  const CategoryGrid({
    super.key,
    required this.categories,
    required this.selectedId,
    required this.onSelected,
  });

  final List<Category> categories;
  final String? selectedId;

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
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.homeCategoriesTitle,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 12),
              _Tiles(
                categories: categories,
                selectedId: selectedId,
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
    final theme = Theme.of(context);
    final hasMore = categories.length > categoryGridPreviewCount;
    final preview = categories.take(categoryGridPreviewCount).toList();
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
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
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
        const SizedBox(height: 8),
        _Tiles(
          categories: preview,
          selectedId: selectedId,
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
    required this.onTap,
  });

  final List<Category> categories;
  final String? selectedId;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 0.82,
      children: [
        for (final category in categories)
          _Tile(
            category: category,
            selected: category.id == selectedId,
            colorScheme: colorScheme,
            onTap: () => onTap(category.id),
          ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.category,
    required this.selected,
    required this.colorScheme,
    required this.onTap,
  });

  final Category category;
  final bool selected;
  final ColorScheme colorScheme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primary : colorScheme.onSurface;
    return Material(
      color: selected
          ? AppColors.primary.withValues(alpha: 0.08)
          : colorScheme.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected
                  ? AppColors.primary
                  : colorScheme.onSurface.withValues(alpha: 0.08),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(categoryIconFor(category), size: 28, color: AppColors.primary),
              const SizedBox(height: 6),
              Text(
                category.localizedName(context),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: color,
                      height: 1.2,
                    ),
              ),
            ],
          ),
        ),
      ),
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
  (Icons.router_outlined, ['router', 'راوتر', 'روتر']),
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
  (Icons.shield_outlined, ['security', 'firewall', 'antivirus', 'امن', 'حمايه', 'فايروول']),
  (Icons.apps, ['software', 'برنامج', 'برمجيات']),
  (Icons.cloud_outlined, ['cloud', 'سحاب']),
  (Icons.sports_esports_outlined, ['game', 'gaming', 'العاب']),
  (Icons.design_services_outlined, ['service', 'خدمه', 'خدمات', 'installation', 'تركيب', 'صيانه', 'maintenance']),
];
