import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../companies/presentation/companies_providers.dart';
import '../domain/sudan_city.dart';
import 'city_picker_sheets.dart';
import 'city_providers.dart';

/// Opens the list of cities one company serves and records the one the
/// customer wants their order or request delivered to. Choosing their own city
/// clears the choice. [servedIds] empty means the company serves every city.
Future<void> chooseDeliveryCity(
  BuildContext context,
  WidgetRef ref, {
  required List<String> servedIds,
}) async {
  final chosen = await showCityPickerSheet(
    context,
    selectedId: ref.read(deliveryCityIdProvider),
    enabledIds: servedIds.isEmpty ? null : servedIds.toSet(),
    title: context.l10n.cityDeliveryPickerTitle,
    subtitle: context.l10n.cityDeliveryPickerHint,
  );
  if (chosen == null) {
    return;
  }
  ref
      .read(deliveryCityOverrideProvider.notifier)
      .set(chosen == ref.read(customerCityIdProvider) ? null : chosen);
}

/// Opens the city list and saves the customer's choice. With [required] the
/// sheet cannot be dismissed (the customer has no city yet).
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
  );
  while (chosen != null) {
    if (chosen == ref.read(customerCityIdProvider)) {
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
    final language = Localizations.localeOf(context).languageCode;
    final label =
        cityById(cityId)?.name(language) ?? context.l10n.cityPickerTitle;
    return Tooltip(
      message: context.l10n.cityChangeTooltip,
      child: TextButton.icon(
        key: const ValueKey('city-button'),
        onPressed: () => chooseCustomerCity(context, ref),
        icon: const Icon(Icons.location_on_outlined, size: 18),
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
