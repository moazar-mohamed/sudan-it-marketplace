import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/product_details_screen.dart';
import '../../../products/presentation/widgets/product_card.dart';
import '../../../products/presentation/widgets/product_offer_price.dart';

/// Products with a running offer, biggest discount first.
List<Product> productsOnOffer(Iterable<Product> products) =>
    products.where((product) => product.hasActiveOffer).toList()
      ..sort((a, b) => b.offerDiscountPercent.compareTo(a.offerDiscountPercent));

/// "Featured offers" on the customer home: a sideways row of the products on
/// offer, with "View all" opening every one of them. Shows nothing when no
/// offer runs.
class FeaturedOffersStrip extends StatelessWidget {
  const FeaturedOffersStrip({super.key, required this.offers});

  /// Products on offer, already filtered by [productsOnOffer].
  final List<Product> offers;

  static const double _cardWidth = 156;

  @override
  Widget build(BuildContext context) {
    if (offers.isEmpty) return const SizedBox.shrink();
    final colors = context.colors;
    return Column(
      key: const ValueKey('featured-offers'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.local_fire_department_rounded,
              color: colors.errorText,
              size: AppSize.iconMd,
            ),
            const SizedBox(width: AppSpacing.s4),
            Expanded(
              child: Text(
                context.l10n.homeFeaturedOffers,
                style: AppTextStyles.h3,
              ),
            ),
            TextButton(
              key: const ValueKey('featured-offers-all'),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => OffersScreen(offers: offers),
                ),
              ),
              style: TextButton.styleFrom(
                foregroundColor: colors.textBrand,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s8),
                minimumSize: const Size(0, 36),
              ),
              child: Text(context.l10n.adminViewAll),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.s8),
        SizedBox(
          height: 236,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: offers.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.s12),
            itemBuilder: (context, index) => SizedBox(
              width: _cardWidth,
              child: _OfferCard(product: offers[index]),
            ),
          ),
        ),
      ],
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final company = product.companyName?.trim() ?? '';
    return Material(
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.mdAll,
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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                AppImageTile(
                  imageUrl: product.imageUrl,
                  size: 120,
                  radius: 0,
                  expand: true,
                ),
                PositionedDirectional(
                  top: AppSpacing.s8,
                  start: AppSpacing.s8,
                  child: OfferDiscountBadge(product: product),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.s8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodyStrong,
                  ),
                  if (company.isNotEmpty)
                    Text(
                      company,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.caption
                          .copyWith(color: colors.textSecondary),
                    ),
                  const SizedBox(height: AppSpacing.s4),
                  Text(
                    '${formatProductPrice(product.salePrice!)} ${product.currency}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodyStrong
                        .copyWith(color: colors.textBrand),
                  ),
                  Text(
                    formatProductPrice(product.price!),
                    maxLines: 1,
                    style: AppTextStyles.caption.copyWith(
                      color: colors.textTertiary,
                      decoration: TextDecoration.lineThrough,
                      decorationColor: colors.textTertiary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Every product on offer, from the home strip's "View all".
class OffersScreen extends StatelessWidget {
  const OffersScreen({super.key, required this.offers});

  final List<Product> offers;

  @override
  Widget build(BuildContext context) {
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.homeFeaturedOffers)),
      body: ListView.separated(
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
        itemCount: offers.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, index) => ProductCard(product: offers[index]),
      ),
    );
  }
}
