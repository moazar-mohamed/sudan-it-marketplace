import 'package:flutter/material.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../domain/sudan_city.dart';

/// Lets the customer choose the one city they shop in. Returns the chosen
/// city id, or null when dismissed. With [dismissible] false the sheet cannot
/// be closed without a choice (the first time, before any city is saved).
///
/// [counts] shows how many companies serve each city. With [enabledIds] only
/// those cities can be chosen (the cities one company serves); the others stay
/// in the list, faded, with the reason. [title] and [subtitle] replace the
/// texts of choosing the customer's own city.
Future<String?> showCityPickerSheet(
  BuildContext context, {
  String? selectedId,
  bool dismissible = true,
  Map<String, int> counts = const {},
  Set<String>? enabledIds,
  String? title,
  String? subtitle,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: dismissible,
    isDismissible: dismissible,
    enableDrag: dismissible,
    builder: (_) => _CitySheet(
      title: title ?? context.l10n.cityPickerTitle,
      subtitle: subtitle ?? context.l10n.cityPickerSubtitle,
      initial: {?selectedId},
      multiple: false,
      counts: counts,
      enabledIds: enabledIds,
    ),
  ).then((result) => result is String ? result : null);
}

/// Lets a company choose the cities it serves. Returns the chosen ids (empty
/// means "all cities"), or null when dismissed.
Future<List<String>?> showCityMultiPickerSheet(
  BuildContext context, {
  required List<String> selectedIds,
}) {
  return showModalBottomSheet<List<String>>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _CitySheet(
      title: context.l10n.cityServiceAreaTitle,
      subtitle: context.l10n.cityServiceAreaHint,
      initial: selectedIds.toSet(),
      multiple: true,
    ),
  );
}

class _CitySheet extends StatefulWidget {
  const _CitySheet({
    required this.title,
    required this.subtitle,
    required this.initial,
    required this.multiple,
    this.counts = const {},
    this.enabledIds,
  });

  final String title;
  final String subtitle;
  final Set<String> initial;
  final bool multiple;
  final Map<String, int> counts;

  /// The only cities that can be chosen; null means all of them.
  final Set<String>? enabledIds;

  @override
  State<_CitySheet> createState() => _CitySheetState();
}

class _CitySheetState extends State<_CitySheet> {
  late final Set<String> _selected = {...widget.initial};
  String _query = '';

  bool _isEnabled(String cityId) =>
      widget.enabledIds == null || widget.enabledIds!.contains(cityId);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final language = Localizations.localeOf(context).languageCode;
    final l10n = context.l10n;
    final needle = _query.trim().toLowerCase();
    final matching = [
      for (final city in sudanCities)
        if ((city.active || _selected.contains(city.id)) &&
            (needle.isEmpty ||
            city.nameAr.contains(needle) ||
            city.nameEn.toLowerCase().contains(needle)))
          city,
    ];
    // With a company's cities to choose from, those come first and the faded
    // ones after them, each group in list order.
    final shown = widget.enabledIds == null
        ? matching
        : [
            ...matching.where((city) => _isEnabled(city.id)),
            ...matching.where((city) => !_isEnabled(city.id)),
          ];
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.s16,
                AppSpacing.s8,
                AppSpacing.s16,
                AppSpacing.s8,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.title, style: AppTextStyles.h2),
                  const SizedBox(height: AppSpacing.s4),
                  Text(
                    widget.subtitle,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            if (!widget.multiple)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
                child: TextField(
                  key: const ValueKey('city-search'),
                  onChanged: (value) => setState(() => _query = value),
                  decoration: InputDecoration(
                    hintText: l10n.citySearchHint,
                    prefixIcon: const Icon(Icons.search_rounded),
                    isDense: true,
                  ),
                ),
              ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  if (shown.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(AppSpacing.s16),
                      child: Text(l10n.cityNoResults),
                    ),
                  for (final city in shown)
                    _CityTile(
                      key: ValueKey('city-${city.id}'),
                      label: city.name(language),
                      subtitle: _isEnabled(city.id)
                          ? (widget.counts.containsKey(city.id)
                                ? l10n.cityCompaniesCount(
                                    widget.counts[city.id]!,
                                  )
                                : null)
                          : l10n.cityCompanyDoesNotServe,
                      enabled: _isEnabled(city.id),
                      selected: _selected.contains(city.id),
                      multiple: widget.multiple,
                      onTap: () {
                        if (!widget.multiple) {
                          Navigator.of(context).pop(city.id);
                          return;
                        }
                        setState(() {
                          if (!_selected.remove(city.id)) {
                            _selected.add(city.id);
                          }
                        });
                      },
                    ),
                ],
              ),
            ),
            if (widget.multiple)
              Padding(
                padding: const EdgeInsets.all(AppSpacing.s16),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    key: const ValueKey('city-multi-done'),
                    onPressed: () =>
                        Navigator.of(context).pop(normalizeCityIds(_selected)),
                    child: Text(context.l10n.commonSave),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CityTile extends StatelessWidget {
  const _CityTile({
    super.key,
    required this.label,
    required this.selected,
    required this.multiple,
    required this.onTap,
    this.subtitle,
    this.enabled = true,
  });

  final String label;
  final String? subtitle;
  final bool selected;
  final bool multiple;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return ListTile(
      enabled: enabled,
      onTap: enabled ? onTap : null,
      title: Text(label),
      subtitle: subtitle == null ? null : Text(subtitle!),
      trailing: multiple
          ? Icon(
              selected ? Icons.check_box_rounded : Icons.check_box_outline_blank,
              color: selected ? colors.primary : colors.iconDefault,
            )
          : (selected
                ? Icon(Icons.check_circle_rounded, color: colors.primary)
                : null),
    );
  }
}
