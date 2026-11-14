import 'package:flutter/material.dart';

import '../constants/phone_countries.dart';
import '../localization/l10n_extension.dart';
import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';
import '../utils/arabic_text.dart';
import 'app_text_field.dart';

/// Opens the country code chooser: a search box, the most used countries,
/// then every country by name. Returns the chosen one, or null when dismissed.
Future<PhoneCountry?> showPhoneCountryPicker(
  BuildContext context, {
  required PhoneCountry selected,
}) {
  return showModalBottomSheet<PhoneCountry>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.92,
      builder: (_, scrollController) => _CountrySheet(
        selected: selected,
        scrollController: scrollController,
      ),
    ),
  );
}

/// Countries whose name, code or dialling code matches [query], in the order
/// of their name in [languageCode]. An empty query matches all of them.
List<PhoneCountry> searchPhoneCountries(String query, String languageCode) {
  final text = normalizeSearchText(query);
  final digits = query.replaceAll(RegExp(r'[^0-9]'), '');
  final matches = [
    for (final country in PhoneCountries.all)
      if (text.isEmpty ||
          normalizeSearchText(country.nameAr).contains(text) ||
          country.nameEn.toLowerCase().contains(text) ||
          country.isoCode.toLowerCase() == text ||
          (digits.isNotEmpty && country.dialCode.startsWith(digits)))
        country,
  ];
  String key(PhoneCountry country) =>
      normalizeSearchText(country.name(languageCode));
  return matches..sort((a, b) => key(a).compareTo(key(b)));
}

class _CountrySheet extends StatefulWidget {
  const _CountrySheet({required this.selected, required this.scrollController});

  final PhoneCountry selected;
  final ScrollController scrollController;

  @override
  State<_CountrySheet> createState() => _CountrySheetState();
}

class _CountrySheetState extends State<_CountrySheet> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final languageCode = Localizations.localeOf(context).languageCode;
    final searching = _query.trim().isNotEmpty;
    final countries = searchPhoneCountries(_query, languageCode);
    // Headers are strings, countries are rows.
    final entries = <Object>[
      if (!searching) ...[
        l10n.phoneCountriesCommon,
        for (final iso in PhoneCountries.common) PhoneCountries.byIso(iso)!,
        l10n.phoneCountriesAll,
      ],
      ...countries,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.s16,
            0,
            AppSpacing.s16,
            AppSpacing.s12,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.phoneChooseCountry, style: AppTextStyles.h2),
              const SizedBox(height: AppSpacing.s12),
              AppSearchField(
                key: const ValueKey('phone-country-search'),
                controller: _searchController,
                hint: l10n.phoneCountrySearchHint,
                onChanged: (value) => setState(() => _query = value),
                onCleared: () => setState(() => _query = ''),
              ),
            ],
          ),
        ),
        Expanded(
          child: countries.isEmpty
              ? ListView(
                  controller: widget.scrollController,
                  padding: const EdgeInsets.all(AppSpacing.s24),
                  children: [
                    Text(
                      l10n.phoneCountryNoMatch,
                      textAlign: TextAlign.center,
                      style: AppTextStyles.body
                          .copyWith(color: context.colors.textSecondary),
                    ),
                  ],
                )
              : ListView.builder(
                  controller: widget.scrollController,
                  padding: const EdgeInsets.only(bottom: AppSpacing.s24),
                  itemCount: entries.length,
                  itemBuilder: (context, index) => switch (entries[index]) {
                    final PhoneCountry country => _CountryRow(
                        country: country,
                        languageCode: languageCode,
                        selected: country == widget.selected,
                        onTap: () => Navigator.of(context).pop(country),
                      ),
                    final Object header => _SectionHeader(header.toString()),
                  },
                ),
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.s16,
        AppSpacing.s12,
        AppSpacing.s16,
        AppSpacing.s4,
      ),
      child: Semantics(
        header: true,
        child: Text(
          title,
          style: AppTextStyles.labelLarge
              .copyWith(color: context.colors.textSecondary),
        ),
      ),
    );
  }
}

class _CountryRow extends StatelessWidget {
  const _CountryRow({
    required this.country,
    required this.languageCode,
    required this.selected,
    required this.onTap,
  });

  final PhoneCountry country;
  final String languageCode;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      key: ValueKey('phone-country-${country.isoCode}'),
      onTap: onTap,
      selected: selected,
      selectedColor: context.colors.textBrand,
      leading: Text(country.flag, style: const TextStyle(fontSize: 22)),
      title: Text(country.name(languageCode)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            country.plusCode,
            textDirection: TextDirection.ltr,
            style: AppTextStyles.bodyStrong.copyWith(
              color: selected
                  ? context.colors.textBrand
                  : context.colors.textSecondary,
            ),
          ),
          if (selected) ...[
            const SizedBox(width: AppSpacing.s8),
            Icon(
              Icons.check_rounded,
              size: AppSize.iconMd,
              color: context.colors.iconBrand,
            ),
          ],
        ],
      ),
    );
  }
}
