import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../companies/domain/entities/company.dart';
import '../../categories/presentation/category_providers.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../companies/presentation/company_details_screen.dart';
import '../../customer_dashboard/data/mock_marketplace_data.dart';
import '../../orders/presentation/checkout_screen.dart';
import '../domain/entities/product.dart';
import 'product_price_strings.dart';
import 'products_providers.dart';
import '../../../core/localization/l10n_extension.dart';

class ProductDetailsScreen extends ConsumerStatefulWidget {
  const ProductDetailsScreen({
    super.key,
    required this.product,
    this.openedFromCompany = false,
  });

  final Product product;
  final bool openedFromCompany;

  @override
  ConsumerState<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends ConsumerState<ProductDetailsScreen> {
  int _quantity = 1;

  String _formatPrice(double price) {
    final parts = price.toStringAsFixed(0).split('.');
    final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return parts[0].replaceAllMapped(regExp, (Match m) => '${m[1]},');
  }

  // Resolves the real Firestore company first (matching the seller shown at
  // checkout), falling back to the demo catalog only when the product has no
  // companyId or the id isn't found anywhere.
  Company? _resolveCompany() {
    final companyId = widget.product.companyId;
    if (companyId != null) {
      final resolved = ref.watch(resolvedCompanyProvider(companyId));
      if (resolved != null) {
        return resolved;
      }
    }
    if (widget.product.companyName != null) {
      for (final company in mockCompanies) {
        if (company.name.toLowerCase() ==
            widget.product.companyName!.toLowerCase()) {
          return company;
        }
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

  void _onBuyNow(BuildContext context) {
    final product = _liveProduct;
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
    final matchedCompany = _resolveCompany();
    final stock = resolveLiveProduct(
      widget.product,
      ref.watch(firestoreProductsStreamProvider),
    );
    final quantity = _effectiveQuantity(stock);
    final unitPrice = stock.price;
    final totalPrice = unitPrice == null ? null : unitPrice * quantity;
    final categoryName =
        ref.watch(categoryPathNamesProvider)[widget.product.categoryId]?.trim() ??
            '';
    final companyName = widget.product.companyName ?? '';
    final specs = widget.product.specifications.entries.toList();
    final description = widget.product.description?.trim() ?? '';
    final screenWidth = MediaQuery.sizeOf(context).width;
    final margin = AppSpacing.screenMargin(screenWidth);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.product.name),
      ),
      body: SingleChildScrollView(
        physics: const ClampingScrollPhysics(),
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  children: [
                    AppImageTile(
                      imageUrl: widget.product.imageUrl,
                      size: 240,
                      radius: AppRadius.lg,
                      expand: true,
                    ),
                    PositionedDirectional(
                      top: AppSpacing.s12,
                      start: AppSpacing.s12,
                      child: StatusChip(
                        label: stock.isAvailable
                            ? context.l10n.productInStockCount(stock.stockCount)
                            : context.l10n.productOutOfStock,
                        tone: stock.isAvailable
                            ? AppTone.success
                            : AppTone.error,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.s16),
                Text(widget.product.name, style: AppTextStyles.h2),
                if (categoryName.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.s8),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: StatusChip(
                      label: categoryName,
                      tone: AppTone.brand,
                      showDot: false,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.s8),
                // A product without a price says so; it is never shown as 0.
                Text(
                  unitPrice == null
                      ? ProductPriceStrings.priceOnRequest(context)
                      : '${_formatPrice(unitPrice)} ${widget.product.currency}',
                  style: unitPrice == null
                      ? AppTextStyles.h2
                          .copyWith(color: AppColors.textSecondary)
                      : AppTextStyles.stat.copyWith(color: AppColors.textBrand),
                ),
                const SizedBox(height: AppSpacing.s16),
                if (matchedCompany != null || companyName.isNotEmpty) ...[
                  AppListCard(
                    onTap: matchedCompany != null
                        ? () => _onViewCompany(context, matchedCompany)
                        : null,
                    showChevron: matchedCompany != null,
                    leading: AppImageTile(
                      imageUrl: matchedCompany?.logoUrl,
                      fallbackText: companyName.isNotEmpty ? companyName : 'C',
                      size: 48,
                    ),
                    content: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          companyName.isNotEmpty
                              ? companyName
                              : matchedCompany?.name ??
                                  context.l10n.productVerifiedSeller,
                          style: AppTextStyles.bodyStrong,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (matchedCompany != null)
                          Row(
                            children: [
                              const Icon(
                                Icons.star_rounded,
                                color: AppColors.warning,
                                size: AppSize.iconMd,
                              ),
                              const SizedBox(width: AppSpacing.s4),
                              Text(
                                matchedCompany.rating.toStringAsFixed(1),
                                style: AppTextStyles.captionStrong,
                              ),
                              const SizedBox(width: AppSpacing.s6),
                              Flexible(
                                child: Text(
                                  context.l10n
                                      .reviewsCount(matchedCompany.reviewCount),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTextStyles.caption.copyWith(
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s16),
                ],
                if (widget.product.isInstallationAvailable) ...[
                  AppBanner(
                    tone: AppTone.info,
                    icon: Icons.handyman_outlined,
                    title: context.l10n.productInstallationAvailable,
                    message: context.l10n.productInstallationNote(
                      _formatPrice(widget.product.installationPrice ?? 0),
                      widget.product.currency,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s20),
                ],
                if (description.isNotEmpty) ...[
                  Text(context.l10n.productDescription, style: AppTextStyles.h3),
                  const SizedBox(height: AppSpacing.s8),
                  Text(description, style: AppTextStyles.body),
                  const SizedBox(height: AppSpacing.s20),
                ],
                if (specs.isNotEmpty) ...[
                  Text(
                    context.l10n.productSpecifications,
                    style: AppTextStyles.h3,
                  ),
                  const SizedBox(height: AppSpacing.s8),
                  AppCard(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.s16,
                      vertical: AppSpacing.s6,
                    ),
                    child: Column(
                      children: [
                        for (var i = 0; i < specs.length; i++) ...[
                          KeyValueRow(label: specs[i].key, value: specs[i].value),
                          if (i < specs.length - 1) const Divider(height: 1),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s24),
                ],
              ],
            ),
          ),
        ),
      ),
      // Sticky bar: quantity and the buy action.
      bottomNavigationBar: AppBottomBar(
        padding: EdgeInsets.symmetric(
          horizontal: margin,
          vertical: AppSpacing.s12,
        ),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
            child: Row(
              children: [
                AppQuantityStepper(
                  value: quantity,
                  canDecrement: quantity > 1,
                  canIncrement: quantity < stock.maxOrderQuantity,
                  onDecrement: _decrementQuantity,
                  onIncrement: _incrementQuantity,
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: AppButton.primary(
                    // Without a price there is nothing to charge, so it
                    // cannot be bought online; the customer contacts the
                    // company instead.
                    onPressed: stock.isAvailable && stock.hasPrice
                        ? () => _onBuyNow(context)
                        : null,
                    label: totalPrice == null
                        ? ProductPriceStrings.priceOnRequest(context)
                        : context.l10n.productBuyNowPrice(
                            _formatPrice(totalPrice),
                            widget.product.currency,
                          ),
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
