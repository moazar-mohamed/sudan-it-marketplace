import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../offers/presentation/offer_price.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/review_widgets.dart';
import '../../../reviews/presentation/reviews_providers.dart';
import '../../domain/entities/product.dart';
import '../product_details_screen.dart';
import '../product_price_strings.dart';

/// A product as a card in a two-column grid: its picture (or the colour and
/// icon of its category) with the offer or "New" badge, then category, name,
/// stars, price and what the company offers (delivery, installation).
class ProductGridCard extends ConsumerWidget {
  const ProductGridCard({
    super.key,
    required this.product,
    this.categoryName,
    this.isNew = false,
    this.tint,
    this.icon,
    this.iconColor,
  });

  /// The height of the photo band at the top of every card.
  static const double photoHeight = 128;

  final Product product;
  final String? categoryName;

  /// Show the "New" badge (when the product has no offer badge to show).
  final bool isNew;

  /// The soft colour behind a picture-less card, and the icon on it.
  final Color? tint;
  final IconData? icon;
  final Color? iconColor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final l10n = context.l10n;
    final category = categoryName?.trim() ?? '';
    final sale = product.salePrice;
    final onOffer = product.hasActiveOffer;
    final stats = ref.watch(
      ratingStatsProvider(RatingStats.productKey(product.id)),
    );
    // Two lines are always reserved for the name, so cards in a row line up.
    final nameStyle = AppTextStyles.body;
    final nameMinHeight = MediaQuery.textScalerOf(context)
        .scale((nameStyle.fontSize ?? 14) * (nameStyle.height ?? 1.5) * 2);

    return Semantics(
      button: true,
      label: product.name,
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.lgAll,
          side: BorderSide(color: colors.borderDefault),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => ProductDetailsScreen(product: product),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Stack(
                children: [
                  // Every card has the same photo band, whatever shape its
                  // photo is (it is cropped to fill it). Width and height are
                  // fixed on the box and on the picture itself: a Stack gives
                  // its children loose constraints, and a photo left to size
                  // itself would be a tile (square) or a strip (wide).
                  Container(
                    width: double.infinity,
                    height: photoHeight,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      color: tint ?? AppTone.brand.background(colors),
                    ),
                    child: AppNetworkImage(
                      url: product.imageUrl ?? '',
                      width: double.infinity,
                      height: photoHeight,
                      fallback: Center(
                        child: Icon(
                          icon ?? Icons.inventory_2_outlined,
                          size: 52,
                          color: iconColor ?? AppTone.brand.accent(colors),
                        ),
                      ),
                    ),
                  ),
                  if (onOffer)
                    PositionedDirectional(
                      top: AppSpacing.s8,
                      end: AppSpacing.s8,
                      child: OfferPill(
                        label: offerBadgeLabel(context, product),
                      ),
                    )
                  else if (isNew)
                    PositionedDirectional(
                      top: AppSpacing.s8,
                      end: AppSpacing.s8,
                      child: _NewPill(label: l10n.homeNewBadge),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.s12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (category.isNotEmpty)
                      Text(
                        category,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.captionStrong.copyWith(
                          color: colors.textBrand,
                        ),
                      ),
                    ConstrainedBox(
                      constraints: BoxConstraints(minHeight: nameMinHeight),
                      child: Text(
                        product.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: nameStyle,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.s4),
                    if (stats == null)
                      Text(
                        l10n.homeNoRatingsYet,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.caption.copyWith(
                          color: colors.textTertiary,
                        ),
                      )
                    else
                      RatingLine(
                        ratingsKey: RatingStats.productKey(product.id),
                      ),
                    const SizedBox(height: AppSpacing.s8),
                    if (sale == null)
                      Text(
                        ProductPriceStrings.priceOnRequest(context),
                        maxLines: 2,
                        style: AppTextStyles.bodyStrong,
                      )
                    else
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: '${product.currency} ',
                              style: AppTextStyles.captionStrong,
                            ),
                            TextSpan(
                              text: formatProductPrice(sale),
                              style: AppTextStyles.bodyLargeStrong,
                            ),
                          ],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: onOffer
                              ? OfferColors.text(context)
                              : colors.textPrimary,
                        ),
                      ),
                    if (onOffer && product.price != null)
                      Text(
                        formatProductPrice(product.price!),
                        style: AppTextStyles.caption.copyWith(
                          color: colors.textTertiary,
                          decoration: TextDecoration.lineThrough,
                          decorationColor: colors.textTertiary,
                        ),
                      ),
                    if (product.isDeliveryAvailable ||
                        product.isInstallationAvailable) ...[
                      const SizedBox(height: AppSpacing.s8),
                      Wrap(
                        spacing: AppSpacing.s6,
                        runSpacing: AppSpacing.s6,
                        children: [
                          if (product.isDeliveryAvailable)
                            _InfoChip(label: l10n.homeFilterDelivery),
                          if (product.isInstallationAvailable)
                            _InfoChip(label: l10n.homeFilterInstallation),
                        ],
                      ),
                    ],
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

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.bgSubtle,
        borderRadius: AppRadius.smAll,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s8,
          vertical: AppSpacing.s2,
        ),
        child: Text(
          label,
          style: AppTextStyles.caption.copyWith(
            color: context.colors.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _NewPill extends StatelessWidget {
  const _NewPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.primary,
        borderRadius: AppRadius.fullAll,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s8,
          vertical: AppSpacing.s2,
        ),
        child: Text(
          label,
          style: AppTextStyles.labelSmall.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
