import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../domain/entities/product.dart';
import '../product_price_strings.dart';

/// A product price with thousands separators and no decimals.
String formatProductPrice(double price) {
  final whole = price.toStringAsFixed(0);
  return whole.replaceAllMapped(
    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]},',
  );
}

/// What a customer pays for [product]: the offer price with the normal price
/// struck through while an offer runs, the normal price otherwise, and "price
/// on request" when there is no price (never 0).
class ProductOfferPrice extends StatelessWidget {
  const ProductOfferPrice({
    super.key,
    required this.product,
    required this.style,
    this.showCurrency = true,
  });

  final Product product;

  /// Style of the price the customer pays; the struck-through normal price is
  /// drawn smaller and muted beside it.
  final TextStyle style;
  final bool showCurrency;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final sale = product.salePrice;
    if (sale == null) {
      return Text(
        ProductPriceStrings.priceOnRequest(context),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: style.copyWith(color: colors.textSecondary),
      );
    }
    final currency = showCurrency ? ' ${product.currency}' : '';
    final saleText = Text(
      '${formatProductPrice(sale)}$currency',
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: style.copyWith(color: colors.textBrand),
    );
    if (!product.hasActiveOffer) return saleText;
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: AppSpacing.s8,
      runSpacing: AppSpacing.s4,
      children: [
        saleText,
        Text(
          formatProductPrice(product.price!),
          style: style.copyWith(
            fontSize: (style.fontSize ?? 14) * 0.8,
            fontWeight: FontWeight.w400,
            color: colors.textTertiary,
            decoration: TextDecoration.lineThrough,
            decorationColor: colors.textTertiary,
          ),
        ),
        OfferDiscountBadge(product: product),
      ],
    );
  }
}

/// "15% off" on a product with a running offer; nothing otherwise.
class OfferDiscountBadge extends StatelessWidget {
  const OfferDiscountBadge({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    if (!product.hasActiveOffer) return const SizedBox.shrink();
    return StatusChip(
      label: context.l10n.offerDiscountBadge(product.offerDiscountPercent),
      tone: AppTone.error,
      showDot: false,
    );
  }
}
