import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../offers/presentation/offer_price.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/reviews_providers.dart';
import '../../../services/presentation/service_details_screen.dart';
import 'home_companies_row.dart';
import 'home_design.dart';
import 'home_service_view.dart';

/// A service on the home: its icon on the colour of its category, name,
/// category, the company a customer would start from with its stars, the
/// description, and at the bottom "Request service" with what the cheapest
/// company asks.
class HomeServiceCard extends ConsumerWidget {
  const HomeServiceCard({
    super.key,
    required this.listing,
    this.category,
    this.categoryName,
  });

  final ServiceListing listing;
  final Category? category;
  final String? categoryName;

  void _open(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ServiceDetailsScreen(service: listing.service),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final l10n = context.l10n;
    final service = listing.service;
    final look = CategoryLook.of(category, fallbackId: service.id);
    final description = service.description.trim();
    final categoryLabel = categoryName?.trim() ?? '';
    final company = listing.leadCompany;
    final ratings =
        ref.watch(ratingsProvider).asData?.value ??
        const <String, RatingStats>{};
    final lead = listing.lead;
    final startsFrom = listing.startsFrom;
    final discount = listing.bestDiscount;

    return Material(
      key: ValueKey('home-service-${service.id}'),
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.xl - 4),
        side: BorderSide(color: colors.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _open(context),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: look.tint(context),
                      borderRadius: AppRadius.lgAll,
                    ),
                    child: Icon(look.icon, size: 28, color: look.accent),
                  ),
                  const SizedBox(width: AppSpacing.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          service.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.h3,
                        ),
                        if (categoryLabel.isNotEmpty)
                          Text(
                            categoryLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.captionStrong.copyWith(
                              color: colors.textBrand,
                            ),
                          ),
                        if (company != null)
                          _CompanyLine(
                            company: company,
                            others: listing.otherCompanies,
                            ratings: ratings,
                          ),
                      ],
                    ),
                  ),
                  if (discount > 0) ...[
                    const SizedBox(width: AppSpacing.s8),
                    OfferPill(label: l10n.offerDiscountBadge(discount)),
                  ],
                ],
              ),
              if (description.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.s12),
                Text(
                  description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.body.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.s12),
              Divider(height: 1, color: colors.borderDefault),
              const SizedBox(height: AppSpacing.s12),
              // A Wrap, so with large text the price goes under the button
              // instead of running off the card.
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: AppSpacing.s12,
                runSpacing: AppSpacing.s8,
                children: [
                  AppButton.primary(
                    label: l10n.serviceRequestAction,
                    onPressed: () => _open(context),
                  ),
                  if (startsFrom != null && lead != null)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          l10n.homeStartsFrom,
                          style: AppTextStyles.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: AppSpacing.s8,
                          children: [
                            if (lead.hasActiveOffer && lead.price != null)
                              Text(
                                formatProductPrice(lead.price!),
                                style: AppTextStyles.caption.copyWith(
                                  color: colors.textTertiary,
                                  decoration: TextDecoration.lineThrough,
                                  decorationColor: colors.textTertiary,
                                ),
                              ),
                            Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(
                                    text: 'SDG ',
                                    style: AppTextStyles.captionStrong,
                                  ),
                                  TextSpan(
                                    text: formatProductPrice(startsFrom),
                                    style: AppTextStyles.h3,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Nile Tech Solutions · 4.6 ★ (+2)": the company a customer would start
/// from, its stars, and how many others perform the service too.
class _CompanyLine extends StatelessWidget {
  const _CompanyLine({
    required this.company,
    required this.others,
    required this.ratings,
  });

  final Company company;
  final int others;
  final Map<String, RatingStats> ratings;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final rating = companyRating(company, ratings);
    final muted = AppTextStyles.caption.copyWith(color: colors.textSecondary);
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: AppSpacing.s4,
      children: [
        Text(company.name, style: muted),
        Text('·', style: muted),
        if (rating.count == 0)
          Text(context.l10n.homeNoRatingsYet, style: muted)
        else ...[
          Text(
            rating.average.toStringAsFixed(1),
            style: AppTextStyles.captionStrong,
          ),
          Icon(Icons.star_rounded, size: AppSize.iconSm, color: colors.warning),
        ],
        if (others > 0) Text('+$others', style: muted),
      ],
    );
  }
}
