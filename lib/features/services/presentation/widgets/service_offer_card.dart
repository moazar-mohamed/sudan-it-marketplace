import 'package:sudan_it_marketplace/features/auth/presentation/require_account.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../chats/presentation/widgets/contact_company_button.dart';
import '../../../cities/presentation/city_tags.dart';
import '../../../company_services/presentation/company_service_providers.dart';
import '../../../companies/presentation/company_details_screen.dart';
import '../../../customer_dashboard/presentation/site/site_cards.dart';
import '../../../customer_dashboard/presentation/site/site_detail_parts.dart';
import '../../../customer_dashboard/presentation/site/site_look.dart';
import '../../../service_requests/presentation/service_request_form_screen.dart';
import '../../../reviews/domain/review.dart';
import '../../domain/entities/catalog_service.dart';

/// A company that offers the service (`.offer-card` on sictm.net): the
/// company with its stars and city, its price (or «تواصل لمعرفة السعر»), its
/// note and city label, then «تواصل» and «اطلب الخدمة».
class ServiceOfferCard extends ConsumerWidget {
  const ServiceOfferCard({
    super.key,
    required this.service,
    required this.offer,
  });

  final CatalogService service;
  final ServiceOffer offer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final colors = context.colors;
    final company = offer.company;
    final note = offer.offer.noteText;
    final city = siteCityText(context, company.city);

    return SiteTile(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => CompanyDetailsScreen(company: company),
              ),
            ),
            child: Row(
              children: [
                SiteCompanyLogo(company: company),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        company.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodyStrong.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          // The stars customers gave this company for this
                          // service.
                          SiteRatingLine(
                            ratingKey: RatingStats.serviceKey(offer.offer.id),
                            fallbackAverage: company.rating,
                            fallbackCount: company.reviewCount,
                            showCount: false,
                          ),
                          if (city.isNotEmpty)
                            Text(
                              ' · $city',
                              style: AppTextStyles.caption.copyWith(
                                fontSize: 13,
                                color: colors.textSecondary,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // A running offer shows its price, the struck-through normal price;
          // without a price the company is asked.
          if (offer.offer.price != null)
            SitePriceText(pricing: offer.offer)
          else
            Text(
              l10n.sitePriceOnRequest,
              style: AppTextStyles.bodyStrong.copyWith(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: colors.textBrand,
              ),
            ),
          if (note != null) ...[
            const SizedBox(height: 12),
            Text(
              note,
              style: AppTextStyles.caption.copyWith(
                fontSize: 13,
                color: colors.textSecondary,
              ),
            ),
          ],
          CompanyCityTag(companyId: company.id, spaceAbove: 12),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ContactCompanyButton.service(
                  companyId: company.id,
                  companyName: company.name,
                  companyServiceId: offer.offer.id,
                  serviceName: service.name,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppButton.primary(
                  label: l10n.serviceRequestAction,
                  expand: true,
                  onPressed: () {
                    if (!requireAccount(context, ref)) return;
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => ServiceRequestFormScreen(
                          service: service,
                          offer: offer.offer,
                          company: company,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
