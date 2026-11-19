import 'package:sudan_it_marketplace/features/auth/presentation/require_account.dart';
import '../../favorites/domain/favorite.dart';
import '../../favorites/presentation/favorite_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../categories/domain/entities/category.dart';
import '../../categories/presentation/category_label.dart';
import '../../companies/domain/entities/company.dart';
import '../../categories/presentation/category_providers.dart';
import '../../cities/presentation/city_button.dart';
import '../../cities/presentation/city_tags.dart';
import '../../chats/presentation/widgets/contact_company_button.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../companies/presentation/company_details_screen.dart';
import '../../customer_dashboard/presentation/site/site_compare.dart';
import '../../customer_dashboard/presentation/site/site_detail_parts.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../../orders/presentation/checkout_screen.dart';
import '../domain/entities/product.dart';
import 'widgets/product_gallery.dart';
import 'products_providers.dart';
import '../../usage/presentation/usage_providers.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../reviews/domain/review.dart';
import '../../reviews/presentation/reviews_providers.dart';

/// A product's page, laid out as sictm.net's (`pages/ProductPage.tsx` on a
/// phone): the path, the pictures, stock, name and heart, stars, compare and
/// share, brand and category, the price, the seller, the delivery city, the
/// installation note, the description, the specifications and the reviews;
/// the quantity, total, «تواصل» and «اشترِ الآن» stay at the bottom.
class ProductDetailsScreen extends ConsumerStatefulWidget {
  const ProductDetailsScreen({
    super.key,
    required this.product,
    this.openedFromCompany = false,
  });

  final Product product;
  final bool openedFromCompany;

  @override
  ConsumerState<ProductDetailsScreen> createState() =>
      _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends ConsumerState<ProductDetailsScreen> {
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    // One more view of this product, for the platform's figures (best effort).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(usageTrackerProvider).productViewed(widget.product.id);
      }
    });
  }

  // Resolves the real Firestore company first (matching the seller shown at
  // checkout); null when the product has no companyId or it is not found.
  Company? _resolveCompany() {
    final companyId = widget.product.companyId;
    if (companyId != null) {
      final resolved = ref.watch(resolvedCompanyProvider(companyId));
      if (resolved != null) {
        return resolved;
      }
    }
    return null;
  }

  void _onViewCompany(BuildContext context, Company company) {
    if (widget.openedFromCompany) {
      Navigator.of(context).pop();
    } else {
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => CompanyDetailsScreen(company: company),
        ),
      );
    }
  }

  void _decrementQuantity() {
    final current = _effectiveQuantity(_liveProduct);
    if (current > 1) {
      setState(() => _quantity = current - 1);
    }
  }

  /// The product as the marketplace stands right now. This screen can be
  /// opened from a stale card or a direct link, so stock is never taken from
  /// the snapshot it was opened with once the live catalogue is known.
  Product get _liveProduct => resolveLiveProduct(
    widget.product,
    ref.read(firestoreProductsStreamProvider),
  );

  /// The chosen quantity, kept within what is left (1 when nothing is).
  int _effectiveQuantity(Product product) {
    final max = product.maxOrderQuantity;
    return max < 1 ? 1 : _quantity.clamp(1, max);
  }

  void _incrementQuantity() {
    final product = _liveProduct;
    final current = _effectiveQuantity(product);
    if (current < product.maxOrderQuantity) {
      setState(() => _quantity = current + 1);
    }
  }

  Future<void> _onBuyNow(BuildContext context) async {
    if (!requireAccount(context, ref)) return;
    final product = _liveProduct;
    final companyId = product.companyId ?? '';
    if (!ref.read(companyServesMyCityProvider(companyId))) {
      // The company does not deliver to the city this order is for: let the
      // customer choose another one now, and go on if they did.
      final company = ref.read(resolvedCompanyProvider(companyId));
      await chooseDeliveryCity(
        context,
        ref,
        servedIds: company?.serviceCityIds ?? const [],
      );
      if (!context.mounted ||
          !ref.read(companyServesMyCityProvider(companyId))) {
        return;
      }
    }
    if (!product.hasPrice) {
      return;
    }
    if (!product.isAvailable) {
      showAppSnackBar(
        context,
        context.l10n.stockOutOfStock(product.name),
        tone: AppTone.error,
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CheckoutScreen(
          product: product,
          quantity: _effectiveQuantity(product),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final product = widget.product;
    final matchedCompany = _resolveCompany();
    final stock = resolveLiveProduct(
      product,
      ref.watch(firestoreProductsStreamProvider),
    );
    final quantity = _effectiveQuantity(stock);
    // The offer price while an offer runs.
    final unitPrice = stock.salePrice;
    final totalPrice = unitPrice == null ? null : unitPrice * quantity;
    // A company that does not deliver to the chosen city can still be bought
    // from: the button asks for another delivery city first.
    final canBuy = stock.isAvailable && stock.hasPrice;
    final contactCompanyId = product.companyId ?? '';
    final canContact = contactCompanyId.isNotEmpty;
    final category = ref.watch(categoriesByIdProvider)[product.categoryId];
    final List<Category> path = category == null
        ? const []
        : ref.watch(categoryTreeProvider).pathOf(category.id);
    final companyName = (product.companyName ?? '').trim().isNotEmpty
        ? product.companyName!.trim()
        : matchedCompany?.name ?? '';
    final specs = product.specifications.entries.toList();
    final description = product.description?.trim() ?? '';
    final color = siteCategoryColor(category, product.id);
    final separator = ' ${sitePathSeparator(context)} ';

    const gap = SizedBox(height: 12);
    final info = <Widget>[
      SiteStatusPill(
        ok: stock.isAvailable,
        label: stock.isAvailable
            ? l10n.productInStockCount(stock.stockCount)
            : l10n.productOutOfStock,
      ),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Semantics(
              header: true,
              child: Text(
                product.name,
                style: AppTextStyles.h1.copyWith(
                  fontSize: 26,
                  height: 1.35,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          FavoriteButton(
            kind: FavoriteKind.product,
            targetId: product.id,
            name: product.name,
          ),
        ],
      ),
      SiteRatingLine(ratingKey: RatingStats.keyFor('product', product.id)),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          SiteCompareButton(productId: product.id, label: true),
          SiteShareButton(title: product.name, path: '/product/${product.id}'),
        ],
      ),
      if (product.brand.isNotEmpty || path.isNotEmpty)
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            if (product.brand.isNotEmpty)
              SitePill(
                key: const ValueKey('product-brand'),
                label: product.brand,
                background: colors.bgSubtle,
                foreground: colors.textSecondary,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
              ),
            if (path.isNotEmpty)
              SitePill(
                label: path.map((c) => c.localizedName(context)).join(separator),
                background: colors.bgSubtle,
                foreground: colors.textSecondary,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
              ),
          ],
        ),
      SitePriceText(pricing: stock, currency: product.currency, size: 28),
      if (stock.hasActiveOffer && stock.offerEndsAt != null)
        Text(
          l10n.offerEndsOn(
            MaterialLocalizations.of(context).formatMediumDate(
              stock.offerEndsAt!,
            ),
          ),
          style: AppTextStyles.caption.copyWith(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: colors.errorText,
          ),
        ),
      if (matchedCompany != null || companyName.isNotEmpty)
        SiteCompanyBox(
          name: companyName,
          company: matchedCompany,
          onTap: matchedCompany == null
              ? null
              : () => _onViewCompany(context, matchedCompany),
          rating: matchedCompany == null
              ? null
              : SiteRatingLine(
                  ratingKey: RatingStats.keyFor('company', matchedCompany.id),
                  fallbackAverage: matchedCompany.rating,
                  fallbackCount: matchedCompany.reviewCount,
                ),
        ),
      // Which city this order is for, and the button that changes it
      // (nothing when the company serves the customer's city).
      if (contactCompanyId.isNotEmpty)
        DeliveryCityBanner(companyId: contactCompanyId),
      if (product.isInstallationAvailable)
        SiteNote(
          icon: Icons.build_outlined,
          title: l10n.productInstallationAvailable,
          message: l10n.siteInstallNote(
            sitePrice(context, product.installationPrice ?? 0, product.currency),
          ),
        ),
    ];

    return Scaffold(
      appBar: AppBar(),
      body: SingleChildScrollView(
        physics: const ClampingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SiteCrumbs(
                  items: [
                    (l10n.siteAllCategories, () => siteOpenShop(context, ref)),
                    for (final c in path)
                      (
                        c.localizedName(context),
                        () => siteOpenShop(context, ref, categoryId: c.id),
                      ),
                    (product.name, null),
                  ],
                ),
                const SizedBox(height: 16),
                ProductGallery(
                  urls: product.imageUrls,
                  placeholder: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [color, color.withValues(alpha: 0.7)],
                      ),
                    ),
                    child: Center(
                      child: SiteGlyph(
                        emoji: siteCategoryEmoji(category, 'box'),
                        size: 110,
                      ),
                    ),
                  ),
                  overlay: stock.hasActiveOffer
                      ? PositionedDirectional(
                          top: 12,
                          start: 12,
                          child: SitePill(
                            label: siteOfferLabel(context, stock),
                            background: const Color(0xFFD32F2F),
                            foreground: Colors.white,
                          ),
                        )
                      : null,
                ),
                const SizedBox(height: 24),
                for (var i = 0; i < info.length; i++) ...[
                  if (i > 0) gap,
                  info[i],
                ],
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  SiteProseTile(
                    title: l10n.productDescription,
                    text: description,
                  ),
                ],
                if (specs.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  SiteTile(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SiteTileTitle(l10n.productSpecifications),
                        const SizedBox(height: 12),
                        SiteSpecs(entries: specs),
                      ],
                    ),
                  ),
                ],
                SiteReviews(provider: targetReviewsProvider(product.id)),
              ],
            ),
          ),
        ),
      ),
      // The buy box stays at the bottom of the screen (`.buy-box` on a phone).
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
          child: Center(
            heightFactor: 1,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: colors.borderDefault),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x38061833),
                      blurRadius: 28,
                      offset: Offset(0, -6),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        _SiteStepper(
                          value: quantity,
                          canDecrement: quantity > 1,
                          canIncrement: quantity < stock.maxOrderQuantity,
                          onDecrement: _decrementQuantity,
                          onIncrement: _incrementQuantity,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              if (totalPrice != null)
                                Text(
                                  l10n.orderTotal,
                                  style: AppTextStyles.caption.copyWith(
                                    fontSize: 13,
                                    color: colors.textSecondary,
                                  ),
                                ),
                              Text(
                                totalPrice == null
                                    ? l10n.sitePriceOnRequest
                                    : sitePrice(
                                        context,
                                        totalPrice,
                                        product.currency,
                                      ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.h3.copyWith(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        if (canContact) ...[
                          Expanded(
                            child: ContactCompanyButton.product(
                              companyId: contactCompanyId,
                              companyName: matchedCompany?.name ?? companyName,
                              productId: stock.id,
                              productName: stock.name,
                              // Without a price (or stock) nothing can be
                              // bought online, so asking the company is the
                              // way on.
                              primary: !canBuy,
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          child: AppButton.primary(
                            onPressed: canBuy ? () => _onBuyNow(context) : null,
                            label: l10n.productBuyNow,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The site's quantity box (`.stepper`): «+», the number, «−» on grey keys.
class _SiteStepper extends StatelessWidget {
  const _SiteStepper({
    required this.value,
    required this.canDecrement,
    required this.canIncrement,
    required this.onDecrement,
    required this.onIncrement,
  });

  final int value;
  final bool canDecrement;
  final bool canIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = context.l10n;
    Widget key(IconData icon, String tip, bool enabled, VoidCallback onTap) {
      return Tooltip(
        message: tip,
        child: Material(
          color: colors.bgSubtle,
          child: InkWell(
            onTap: enabled ? onTap : null,
            child: SizedBox(
              width: 40,
              height: 40,
              child: Icon(
                icon,
                size: 20,
                color: enabled ? colors.textPrimary : colors.textDisabled,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          key(Icons.add, l10n.commonQuantityIncrease, canIncrement, onIncrement),
          SizedBox(
            width: 44,
            child: Semantics(
              liveRegion: true,
              child: Text(
                '$value',
                textAlign: TextAlign.center,
                style: AppTextStyles.bodyStrong.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          key(
            Icons.remove,
            l10n.commonQuantityDecrease,
            canDecrement,
            onDecrement,
          ),
        ],
      ),
    );
  }
}
