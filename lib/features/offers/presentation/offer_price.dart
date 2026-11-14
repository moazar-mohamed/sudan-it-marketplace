import 'package:flutter/material.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../products/domain/entities/product.dart';
import '../../products/presentation/product_price_strings.dart';
import '../domain/offer_pricing.dart';

/// A price with thousands separators and no decimals.
String formatProductPrice(double price) {
  final whole = price.toStringAsFixed(0);
  return whole.replaceAllMapped(
    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]},',
  );
}

/// What a customer pays for a product or service: the offer price with the
/// normal price struck through and the offer's badge while an offer runs,
/// the normal price otherwise. Without a price it shows [whenNoPrice].
class OfferPriceText extends StatelessWidget {
  const OfferPriceText({
    super.key,
    required this.pricing,
    required this.style,
    this.currency = 'SDG',
    this.whenNoPrice,
  });

  final OfferPricing pricing;

  /// Style of the price the customer pays; the struck-through normal price is
  /// drawn smaller and muted beside it.
  final TextStyle style;
  final String currency;

  /// Shown when there is no price; nothing when null.
  final String? whenNoPrice;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final sale = pricing.salePrice;
    if (sale == null) {
      final text = whenNoPrice;
      if (text == null) return const SizedBox.shrink();
      return Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: style.copyWith(color: colors.textSecondary),
      );
    }
    final saleText = Text(
      '${formatProductPrice(sale)} $currency',
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: style.copyWith(color: colors.textBrand),
    );
    if (!pricing.hasActiveOffer) return saleText;
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: AppSpacing.s8,
      runSpacing: AppSpacing.s4,
      children: [
        saleText,
        Text(
          formatProductPrice(pricing.price!),
          style: style.copyWith(
            fontSize: (style.fontSize ?? 14) * 0.8,
            fontWeight: FontWeight.w400,
            color: colors.textTertiary,
            decoration: TextDecoration.lineThrough,
            decorationColor: colors.textTertiary,
          ),
        ),
        OfferBadgeChip(pricing: pricing),
      ],
    );
  }
}

/// [OfferPriceText] for a product, which says "price on request" when the
/// company left the price out (never 0).
class ProductOfferPrice extends StatelessWidget {
  const ProductOfferPrice({
    super.key,
    required this.product,
    required this.style,
  });

  final Product product;
  final TextStyle style;

  @override
  Widget build(BuildContext context) => OfferPriceText(
        pricing: product,
        style: style,
        currency: product.currency,
        whenNoPrice: ProductPriceStrings.priceOnRequest(context),
      );
}

/// The badge's words: "15% off", "Special offer" or "Limited time".
String offerBadgeLabel(BuildContext context, OfferPricing pricing) {
  final l10n = context.l10n;
  return switch (pricing.offerBadge) {
    OfferBadge.special => l10n.offerBadgeSpecial,
    OfferBadge.limited => l10n.offerBadgeLimited,
    OfferBadge.discount || null =>
      l10n.offerDiscountBadge(pricing.offerDiscountPercent),
  };
}

/// The offer's badge on a running offer; nothing otherwise.
class OfferBadgeChip extends StatelessWidget {
  const OfferBadgeChip({
    super.key,
    required this.pricing,
    this.showEnded = false,
  });

  final OfferPricing pricing;

  /// Also show the badge of an offer that has ended (the company's list).
  final bool showEnded;

  @override
  Widget build(BuildContext context) {
    if (!pricing.hasActiveOffer && !(showEnded && pricing.hasOffer)) {
      return const SizedBox.shrink();
    }
    return StatusChip(
      label: offerBadgeLabel(context, pricing),
      tone: pricing.hasActiveOffer ? AppTone.error : AppTone.neutral,
      showDot: false,
    );
  }
}

/// The orange of offers: tags and discount badges (solid, white text) and the
/// price of something on offer.
class OfferColors {
  OfferColors._();

  /// Fill of a badge. Solid with white text, the same in light and dark mode.
  static const Color solid = Color(0xFFC2410C);

  /// The price of something on offer, readable on the current surface.
  static Color text(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? context.colors.progressText
          : solid;
}

/// The solid orange pill of a running offer: "20% off", "Special offer", ...
class OfferPill extends StatelessWidget {
  const OfferPill({super.key, required this.label, this.large = false});

  final String label;

  /// The bigger pill of the hero card.
  final bool large;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: OfferColors.solid,
        borderRadius: AppRadius.fullAll,
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: large ? AppSpacing.s12 : AppSpacing.s8,
          vertical: large ? AppSpacing.s4 : AppSpacing.s2,
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: (large ? AppTextStyles.labelMedium : AppTextStyles.labelSmall)
              .copyWith(color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}
