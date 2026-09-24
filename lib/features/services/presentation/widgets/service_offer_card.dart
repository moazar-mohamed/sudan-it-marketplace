import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../company_services/presentation/company_service_providers.dart';
import '../../../service_requests/presentation/service_request_form_screen.dart';
import '../../../service_requests/presentation/service_request_labels.dart';
import '../../domain/entities/catalog_service.dart';

/// A company that offers the service, with the company's own price (shown
/// ONLY when the company set one — no placeholder otherwise) and note, and
/// the action to request the service from it.
class ServiceOfferCard extends StatelessWidget {
  const ServiceOfferCard({
    super.key,
    required this.service,
    required this.offer,
  });

  final CatalogService service;
  final ServiceOffer offer;

  @override
  Widget build(BuildContext context) {
    final company = offer.company;
    final price = offer.offer.price;
    final note = offer.offer.noteText;
    final city = company.city?.trim() ?? '';

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppImageTile(
                imageUrl: company.logoUrl,
                fallbackText: company.name.isNotEmpty ? company.name : 'C',
                size: 44,
              ),
              const SizedBox(width: AppSpacing.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      company.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodyStrong,
                    ),
                    Row(
                      children: [
                        const Icon(
                          Icons.star_rounded,
                          color: AppColors.warning,
                          size: AppSize.iconMd,
                        ),
                        const SizedBox(width: AppSpacing.s2),
                        Text(
                          company.rating.toStringAsFixed(1),
                          style: AppTextStyles.captionStrong,
                        ),
                        if (city.isNotEmpty) ...[
                          const SizedBox(width: AppSpacing.s12),
                          const Icon(
                            Icons.location_on_outlined,
                            size: AppSize.iconSm,
                            color: AppColors.iconDefault,
                          ),
                          const SizedBox(width: AppSpacing.s2),
                          Flexible(
                            child: Text(
                              city,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.caption
                                  .copyWith(color: AppColors.textSecondary),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              // Only a price the company set is shown; nothing otherwise.
              if (price != null) ...[
                const SizedBox(width: AppSpacing.s8),
                Text(
                  formatServicePrice(price),
                  style: AppTextStyles.bodyStrong
                      .copyWith(color: AppColors.textBrand),
                ),
              ],
            ],
          ),
          if (note != null) ...[
            const SizedBox(height: AppSpacing.s8),
            Text(
              note,
              style: AppTextStyles.caption
                  .copyWith(color: AppColors.textSecondary),
            ),
          ],
          const SizedBox(height: AppSpacing.s12),
          AppButton.primary(
            icon: Icons.send_outlined,
            label: context.l10n.serviceRequestAction,
            expand: true,
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => ServiceRequestFormScreen(
                  service: service,
                  offer: offer.offer,
                  company: company,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
