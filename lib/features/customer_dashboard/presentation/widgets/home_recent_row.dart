import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../offers/presentation/offer_price.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/product_details_screen.dart';
import '../../../products/presentation/product_price_strings.dart';
import 'home_design.dart';

/// "Recently added": the newest products as wide cards in a sideways row.
/// Shows nothing when nothing was added lately.
class HomeRecentRow extends StatelessWidget {
  const HomeRecentRow({
    super.key,
    required this.products,
    required this.categories,
    required this.horizontalPadding,
    required this.onViewAll,
  });

  /// Already the newest first (see `recentProducts`).
  final List<Product> products;
  final Map<String, Category> categories;
  final double horizontalPadding;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    final side = EdgeInsets.symmetric(horizontal: horizontalPadding);
    return Column(
      key: const ValueKey('home-recent'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: side,
          child: HomeSectionHeader(
            title: context.l10n.homeRecentlyAdded,
            actionLabel: context.l10n.adminViewAll,
            actionKey: const ValueKey('home-recent-all'),
            onAction: onViewAll,
          ),
        ),
        const SizedBox(height: AppSpacing.s12),
        SizedBox(
          height: 112,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: side,
            itemCount: products.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.s12),
            itemBuilder: (context, i) => _RecentCard(
              product: products[i],
              look: CategoryLook.of(
                categories[products[i].categoryId],
                fallbackId: products[i].id,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _RecentCard extends StatelessWidget {
  const _RecentCard({required this.product, required this.look});

  final Product product;
  final CategoryLook look;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final sale = product.salePrice;
    return SizedBox(
      width: 290,
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
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.s12),
            child: Row(
              children: [
                Container(
                  width: 84,
                  height: 84,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: look.tint(context),
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: AppNetworkImage(
                    url: product.imageUrl ?? '',
                    fallback: Center(
                      child: Icon(look.icon, size: 38, color: look.accent),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.brandPrimarySubtle,
                          borderRadius: AppRadius.smAll,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.s8,
                            vertical: AppSpacing.s2,
                          ),
                          child: Text(
                            context.l10n.homeNewBadge,
                            style: AppTextStyles.labelSmall.copyWith(
                              color: colors.textBrand,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.s4),
                      Text(
                        product.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.body.copyWith(height: 1.3),
                      ),
                      const SizedBox(height: AppSpacing.s4),
                      Text(
                        sale == null
                            ? ProductPriceStrings.priceOnRequest(context)
                            : '${product.currency} ${formatProductPrice(sale)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodyStrong.copyWith(
                          color: product.hasActiveOffer
                              ? OfferColors.text(context)
                              : colors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
