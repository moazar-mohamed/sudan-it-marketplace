import 'package:flutter/material.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../products/presentation/product_details_screen.dart';
import '../../services/presentation/service_details_screen.dart';
import '../domain/offer_item.dart';
import 'offer_price.dart';

/// Opens what a customer tapped in the offers: the product, or the service
/// with the companies that perform it.
void openOfferItem(BuildContext context, OfferItem item) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => switch (item) {
        ProductOfferItem(:final product) =>
          ProductDetailsScreen(product: product),
        ServiceOfferItem(:final service) =>
          ServiceDetailsScreen(service: service),
      },
    ),
  );
}

/// One offer as customers see it in "Featured offers": picture with the
/// offer's badge, name, company, offer price and the struck-through normal
/// price. Also used as the company's live preview.
class OfferCard extends StatelessWidget {
  const OfferCard({super.key, required this.item, this.onTap});

  static const double width = 156;
  static const double height = 244;

  final OfferItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final pricing = item.pricing;
    final sale = pricing.salePrice;
    final normal = pricing.price;
    final isService = item is ServiceOfferItem;
    return SizedBox(
      width: width,
      height: height,
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.mdAll,
          side: BorderSide(color: colors.borderDefault),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  AppImageTile(
                    imageUrl: item.imageUrl,
                    fallbackIcon: isService
                        ? Icons.design_services_outlined
                        : Icons.inventory_2_outlined,
                    size: 120,
                    radius: 0,
                    expand: true,
                  ),
                  PositionedDirectional(
                    top: AppSpacing.s8,
                    start: AppSpacing.s8,
                    child: OfferBadgeChip(pricing: pricing, showEnded: true),
                  ),
                  if (isService)
                    PositionedDirectional(
                      bottom: AppSpacing.s8,
                      end: AppSpacing.s8,
                      child: StatusChip(
                        label: context.l10n.offerKindService,
                        tone: AppTone.brand,
                        showDot: false,
                      ),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.s8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodyStrong,
                    ),
                    if (item.companyName.isNotEmpty)
                      Text(
                        item.companyName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.caption
                            .copyWith(color: colors.textSecondary),
                      ),
                    const SizedBox(height: AppSpacing.s4),
                    if (pricing.hasOffer) ...[
                      Text(
                        '${formatProductPrice(pricing.offerPrice!)} ${item.currency}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodyStrong
                            .copyWith(color: colors.textBrand),
                      ),
                      Text(
                        formatProductPrice(normal!),
                        maxLines: 1,
                        style: AppTextStyles.caption.copyWith(
                          color: colors.textTertiary,
                          decoration: TextDecoration.lineThrough,
                          decorationColor: colors.textTertiary,
                        ),
                      ),
                    ] else if (sale != null)
                      Text(
                        '${formatProductPrice(sale)} ${item.currency}',
                        maxLines: 1,
                        style: AppTextStyles.bodyStrong
                            .copyWith(color: colors.textBrand),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
