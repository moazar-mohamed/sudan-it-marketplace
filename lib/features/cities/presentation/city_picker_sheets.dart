import 'package:flutter/material.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../domain/sudan_city.dart';

/// What the picker returns when the customer chooses to browse every city.
const browseAllCitiesChoice = '*';

/// Lets the customer choose the one city they shop in. Returns the chosen
/// city id (or [browseAllCitiesChoice]), or null when dismissed. With
/// [dismissible] false the sheet cannot be closed without a choice (the first
/// time, before any city is saved).
///
/// [counts] shows how many companies serve each city; [locate] finds the
/// nearest city to the phone (null when it cannot); [allowBrowseAll] adds the
/// "browse all cities" row.
Future<String?> showCityPickerSheet(
  BuildContext context, {
  String? selectedId,
  bool dismissible = true,
  Map<String, int> counts = const {},
  Future<String?> Function()? locate,
  bool allowBrowseAll = false,
  bool browseAllSelected = false,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: dismissible,
    isDismissible: dismissible,
    enableDrag: dismissible,
    builder: (_) => _CitySheet(
      title: context.l10n.cityPickerTitle,
      subtitle: context.l10n.cityPickerSubtitle,
      initial: {?selectedId},
      multiple: false,
      counts: counts,
      locate: locate,
      allowBrowseAll: allowBrowseAll,
      browseAllSelected: browseAllSelected,
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
    this.locate,
    this.allowBrowseAll = false,
    this.browseAllSelected = false,
  });

  final String title;
  final String subtitle;
  final Set<String> initial;
  final bool multiple;
  final Map<String, int> counts;
  final Future<String?> Function()? locate;
  final bool allowBrowseAll;
  final bool browseAllSelected;

  @override
  State<_CitySheet> createState() => _CitySheetState();
}

class _CitySheetState extends State<_CitySheet> {
  late final Set<String> _selected = {...widget.initial};
  String _query = '';
  bool _locating = false;
  bool _locateFailed = false;

  Future<void> _useLocation() async {
    setState(() {
      _locating = true;
      _locateFailed = false;
    });
    final id = await widget.locate!();
    if (!mounted) return;
    if (id == null) {
      setState(() {
        _locating = false;
        _locateFailed = true;
      });
      return;
    }
    Navigator.of(context).pop(id);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final language = Localizations.localeOf(context).languageCode;
    final l10n = context.l10n;
    final needle = _query.trim().toLowerCase();
    final shown = [
      for (final city in sudanCities)
        if ((city.active || _selected.contains(city.id)) &&
            (needle.isEmpty ||
            city.nameAr.contains(needle) ||
            city.nameEn.toLowerCase().contains(needle)))
          city,
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
            if (widget.locate != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.s16,
                  AppSpacing.s8,
                  AppSpacing.s16,
                  0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    OutlinedButton.icon(
                      key: const ValueKey('city-use-location'),
                      onPressed: _locating ? null : _useLocation,
                      icon: _locating
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.my_location_outlined),
                      label: Text(l10n.cityUseMyLocation),
                    ),
                    if (_locateFailed)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.s4),
                        child: Text(
                          l10n.cityLocationFailed,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.errorText,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  if (widget.allowBrowseAll && needle.isEmpty)
                    ListTile(
                      key: const ValueKey('city-browse-all'),
                      leading: const Icon(Icons.public_rounded),
                      title: Text(l10n.cityBrowseAll),
                      subtitle: Text(l10n.cityBrowseAllHint),
                      trailing: widget.browseAllSelected
                          ? Icon(Icons.check_circle_rounded, color: colors.primary)
                          : null,
                      onTap: () => Navigator.of(context).pop(browseAllCitiesChoice),
                    ),
                  if (shown.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(AppSpacing.s16),
                      child: Text(l10n.cityNoResults),
                    ),
                  for (final city in shown)
                    _CityTile(
                      key: ValueKey('city-${city.id}'),
                      label: city.name(language),
                      subtitle: widget.counts.containsKey(city.id)
                          ? l10n.cityCompaniesCount(widget.counts[city.id]!)
                          : null,
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
  });

  final String label;
  final String? subtitle;
  final bool selected;
  final bool multiple;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return ListTile(
      onTap: onTap,
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
