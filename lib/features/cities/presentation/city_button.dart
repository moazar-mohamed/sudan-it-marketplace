import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../location/data/location_service.dart';
import '../domain/sudan_city.dart';
import 'city_picker_sheets.dart';
import 'city_providers.dart';

/// The nearest city to the phone, or null when its position cannot be found
/// (permission refused, GPS off) or it is not near any listed city.
Future<String?> _nearestCityToPhone(WidgetRef ref) async {
  final result = await ref.read(locationServiceProvider).currentLocation();
  final location = result.location;
  if (location == null) {
    return null;
  }
  return nearestCity(location.latitude, location.longitude)?.id;
}

/// Opens the city list and saves the customer's choice. With [required] the
/// sheet cannot be dismissed (the customer has no city yet), and "browse all
/// cities" is not offered: the first city is the one they order from.
Future<void> chooseCustomerCity(
  BuildContext context,
  WidgetRef ref, {
  bool required = false,
}) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  final failedText = context.l10n.citySaveFailed;
  var chosen = await showCityPickerSheet(
    context,
    selectedId: ref.read(customerCityIdProvider),
    dismissible: !required,
    counts: ref.read(cityCompanyCountsProvider),
    locate: () => _nearestCityToPhone(ref),
    allowBrowseAll: !required && ref.read(customerCityIdProvider) != null,
    browseAllSelected: ref.read(browseAllCitiesProvider),
  );
  while (chosen != null) {
    if (chosen == browseAllCitiesChoice) {
      ref.read(browseAllCitiesProvider.notifier).set(true);
      return;
    }
    if (chosen == ref.read(customerCityIdProvider)) {
      ref.read(browseAllCitiesProvider.notifier).set(false);
      return;
    }
    if (await saveCustomerCity(ref, chosen)) {
      return;
    }
    messenger?.showSnackBar(SnackBar(content: Text(failedText)));
    if (!required || !context.mounted) {
      return;
    }
    chosen = await showCityPickerSheet(
      context,
      dismissible: false,
      counts: ref.read(cityCompanyCountsProvider),
      locate: () => _nearestCityToPhone(ref),
    );
  }
}

/// The customer's city in the app bar; tapping it changes the city.
class CityButton extends ConsumerWidget {
  const CityButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(citiesProvider);
    final cityId = ref.watch(customerCityIdProvider);
    final browseAll = ref.watch(browseAllCitiesProvider);
    final language = Localizations.localeOf(context).languageCode;
    final label = browseAll
        ? context.l10n.cityBrowseAll
        : cityById(cityId)?.name(language) ?? context.l10n.cityPickerTitle;
    return Tooltip(
      message: context.l10n.cityChangeTooltip,
      child: TextButton.icon(
        key: const ValueKey('city-button'),
        onPressed: () => chooseCustomerCity(context, ref),
        icon: Icon(
          browseAll ? Icons.public_rounded : Icons.location_on_outlined,
          size: 18,
        ),
        label: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 96),
          child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
        style: TextButton.styleFrom(
          foregroundColor: Theme.of(context).appBarTheme.foregroundColor ??
              context.colors.textPrimary,
          visualDensity: VisualDensity.compact,
          padding: const EdgeInsets.symmetric(horizontal: 8),
        ),
      ),
    );
  }
}
