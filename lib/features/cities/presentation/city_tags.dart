import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../companies/domain/entities/company.dart';
import '../../companies/presentation/companies_providers.dart';
import '../domain/sudan_city.dart';
import 'city_button.dart';
import 'city_providers.dart';

/// "Serves: Port Sudan, Kassala" on a company that does not serve the
/// customer's city. Nothing for a company that does, or while the customer has
/// no city. Customers are not kept away from such companies (they may be
/// ordering for someone elsewhere); this only tells them where it delivers.
///
/// With [compact] it is one ellipsized line (for the narrow grid card),
/// otherwise a chip.
class CompanyCityTag extends ConsumerWidget {
  const CompanyCityTag({
    super.key,
    required this.companyId,
    this.compact = false,
    this.spaceAbove = 0,
  });

  final String companyId;
  final bool compact;

  /// Space kept above the label, only while it is shown.
  final double spaceAbove;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(citiesProvider);
    final company = ref.watch(companyOutsideMyCityProvider(companyId));
    if (company == null) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: EdgeInsets.only(top: spaceAbove),
      child: CityServesChip(company: company, compact: compact),
    );
  }
}

/// On a company's or product's page: which city this order is for. When the
/// company does not serve it, a warning that names the cities it does serve,
/// with the button that changes the delivery city (ordering stays possible
/// once it is changed). When the customer chose another city for this order
/// and the company serves it, a short note with the same button. Nothing when
/// the company serves the customer's own city.
class DeliveryCityBanner extends ConsumerWidget {
  const DeliveryCityBanner({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(citiesProvider);
    final company = companyId.isEmpty
        ? null
        : ref.watch(resolvedCompanyProvider(companyId));
    final cityId = ref.watch(deliveryCityIdProvider);
    if (company == null) {
      return const SizedBox.shrink();
    }
    final language = Localizations.localeOf(context).languageCode;
    final l10n = context.l10n;
    final cityName = cityById(cityId)?.name(language) ?? '';
    final serves = company.servesCity(cityId);
    final chosenElsewhere = ref.watch(deliveryCityOverrideProvider) != null;
    if (serves && !chosenElsewhere) {
      return const SizedBox.shrink();
    }
    return AppBanner(
      key: const ValueKey('delivery-city-banner'),
      tone: serves ? AppTone.info : AppTone.warning,
      icon: serves ? Icons.local_shipping_outlined : Icons.location_off_outlined,
      title: serves
          ? l10n.cityDeliveringTo(cityName)
          : l10n.cityNotServedOnlyTitle(
              cityNamesText(company.serviceCityIds, language),
            ),
      message: serves ? l10n.cityDeliveryForOther : l10n.cityNotServedOnlyBody(cityName),
      action: Align(
        alignment: AlignmentDirectional.centerStart,
        child: OutlinedButton(
          key: const ValueKey('delivery-city-change'),
          onPressed: () => chooseDeliveryCity(
            context,
            ref,
            servedIds: company.serviceCityIds,
          ),
          child: Text(l10n.cityDeliveryChangeButton),
        ),
      ),
    );
  }
}

/// The break in a list between the companies that serve the customer's city
/// and the ones that do not: "Other companies" and why they come after.
class OtherCompaniesHeader extends ConsumerWidget {
  const OtherCompaniesHeader({super.key, required this.cityId});

  final String cityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(citiesProvider);
    final language = Localizations.localeOf(context).languageCode;
    final colors = context.colors;
    final cityName = cityById(cityId)?.name(language) ?? '';
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.s8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: colors.borderDefault)),
        ),
        child: Padding(
          padding: const EdgeInsets.only(top: AppSpacing.s12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.cityOtherCompaniesTitle,
                style: AppTextStyles.bodyStrong,
              ),
              const SizedBox(height: AppSpacing.s4),
              Text(
                context.l10n.cityOtherCompaniesHint(cityName),
                style: AppTextStyles.caption.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The label itself, for a screen that already holds the company.
class CityServesChip extends StatelessWidget {
  const CityServesChip({super.key, required this.company, this.compact = false});

  final Company company;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final language = Localizations.localeOf(context).languageCode;
    final names = cityNamesText(company.serviceCityIds, language);
    if (names.isEmpty) {
      return const SizedBox.shrink();
    }
    final label = context.l10n.cityServesList(names);
    if (!compact) {
      return StatusChip(
        key: ValueKey('city-tag-${company.id}'),
        label: label,
        tone: AppTone.warning,
        showDot: false,
      );
    }
    final colors = context.colors;
    return Row(
      key: ValueKey('city-tag-${company.id}'),
      children: [
        Icon(
          Icons.location_off_outlined,
          size: AppSize.iconSm,
          color: colors.warningText,
        ),
        const SizedBox(width: AppSpacing.s4),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.caption.copyWith(color: colors.warningText),
          ),
        ),
      ],
    );
  }
}

/// The city this order is delivered to: the customer's own city until they
/// change it (an order for someone elsewhere), with whether the company serves
/// it. Changing it does not change the customer's own city.
class DeliveryCityRow extends ConsumerWidget {
  const DeliveryCityRow({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(citiesProvider);
    final l10n = context.l10n;
    final colors = context.colors;
    final language = Localizations.localeOf(context).languageCode;
    final cityId = ref.watch(deliveryCityIdProvider);
    final company = companyId.isEmpty
        ? null
        : ref.watch(resolvedCompanyProvider(companyId));
    final serves = company?.servesCity(cityId) ?? true;
    final cityName = cityById(cityId)?.name(language);
    return Column(
      key: const ValueKey('delivery-city-row'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Material(
          color: colors.bgSubtle,
          borderRadius: AppRadius.mdAll,
          child: InkWell(
            borderRadius: AppRadius.mdAll,
            onTap: () => chooseDeliveryCity(
              context,
              ref,
              servedIds: company?.serviceCityIds ?? const [],
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.s12),
              child: Row(
                children: [
                  Icon(
                    Icons.location_on_outlined,
                    color: colors.iconBrand,
                    size: AppSize.iconMd,
                  ),
                  const SizedBox(width: AppSpacing.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.cityDeliveryLabel,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                        Text(
                          cityName ?? l10n.cityDeliveryChoose,
                          style: AppTextStyles.bodyStrong,
                        ),
                      ],
                    ),
                  ),
                  Text(
                    l10n.cityDeliveryChange,
                    style: AppTextStyles.labelLarge.copyWith(
                      color: colors.textBrand,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.s8),
        if (company != null && cityName != null)
          Text(
            serves
                ? l10n.cityDeliveryServed(company.name)
                : l10n.cityNotServedOnlyBody(cityName),
            style: AppTextStyles.caption.copyWith(
              color: serves ? colors.successText : colors.errorText,
            ),
          ),
        const SizedBox(height: AppSpacing.s4),
        Text(
          l10n.cityDeliveryForOther,
          style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
        ),
      ],
    );
  }
}
