import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/widgets/product_grid_card.dart';
import '../../../reviews/presentation/reviews_providers.dart';
import 'home_design.dart';
import 'home_product_view.dart';

/// "All products" on the home: the sort and filter chips, then the products
/// as a grid of cards (two columns on a phone, more on wider screens).
class HomeProductsSection extends ConsumerWidget {
  const HomeProductsSection({
    super.key,
    required this.products,
    required this.categories,
    required this.categoryNames,
    required this.sort,
    required this.filters,
    required this.onSortChanged,
    required this.onFiltersChanged,
    required this.horizontalPadding,
    this.headerKey,
  });

  /// The products of the category being browsed, before sort and filters.
  final List<Product> products;
  final Map<String, Category> categories;
  final Map<String, String> categoryNames;
  final ProductSort sort;
  final ProductFilters filters;
  final ValueChanged<ProductSort> onSortChanged;
  final ValueChanged<ProductFilters> onFiltersChanged;
  final double horizontalPadding;

  /// Lets "Recently added → View all" scroll here.
  final Key? headerKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final ratings = ref.watch(ratingsProvider).asData?.value ?? const {};
    final shown = viewProducts(
      products,
      sort: sort,
      filters: filters,
      ratings: ratings,
    );
    final now = DateTime.now();
    final side = EdgeInsets.symmetric(horizontal: horizontalPadding);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          key: headerKey,
          padding: side,
          child: Text(l10n.homeAllProducts, style: AppTextStyles.h2),
        ),
        const SizedBox(height: AppSpacing.s12),
        if (products.isNotEmpty)
          _Controls(
            sort: sort,
            filters: filters,
            onSortChanged: onSortChanged,
            onFiltersChanged: onFiltersChanged,
            padding: side,
          ),
        const SizedBox(height: AppSpacing.s12),
        Padding(
          padding: side,
          child: products.isEmpty
              ? AppEmptyState(
                  icon: Icons.search_off_rounded,
                  message: l10n.homeNoProducts,
                )
              : shown.isEmpty
              ? AppEmptyState(
                  icon: Icons.filter_alt_off_outlined,
                  message: l10n.homeNoMatchingProducts,
                )
              : _Grid(
                  children: [
                    for (final product in shown) _card(context, product, now),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _card(BuildContext context, Product product, DateTime now) {
    final look = CategoryLook.of(
      categories[product.categoryId],
      fallbackId: product.id,
    );
    return ProductGridCard(
      product: product,
      categoryName: categoryNames[product.categoryId],
      isNew: isNewProduct(product, now),
      tint: look.tint(context),
      icon: look.icon,
      iconColor: look.accent,
    );
  }
}

/// Cards in rows of equal height, as many columns as the width allows.
class _Grid extends StatelessWidget {
  const _Grid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width >= 900 ? 4 : (width >= 600 ? 3 : 2);
        const gap = AppSpacing.s12;
        final rows = <Widget>[];
        for (var i = 0; i < children.length; i += columns) {
          if (i > 0) rows.add(const SizedBox(height: gap));
          rows.add(
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var c = 0; c < columns; c++) ...[
                    if (c > 0) const SizedBox(width: gap),
                    Expanded(
                      child: i + c < children.length
                          ? children[i + c]
                          : const SizedBox.shrink(),
                    ),
                  ],
                ],
              ),
            ),
          );
        }
        return Column(
          key: const ValueKey('home-products-grid'),
          children: rows,
        );
      },
    );
  }
}

/// The dark sort button and the filter chips, in one sideways row.
class _Controls extends StatelessWidget {
  const _Controls({
    required this.sort,
    required this.filters,
    required this.onSortChanged,
    required this.onFiltersChanged,
    required this.padding,
  });

  final ProductSort sort;
  final ProductFilters filters;
  final ValueChanged<ProductSort> onSortChanged;
  final ValueChanged<ProductFilters> onFiltersChanged;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final chips = [
      (
        l10n.homeFilterOffers,
        filters.offers,
        () => filters.copyWith(offers: !filters.offers),
      ),
      (
        l10n.homeFilterDelivery,
        filters.delivery,
        () => filters.copyWith(delivery: !filters.delivery),
      ),
      (
        l10n.homeFilterInstallation,
        filters.installation,
        () => filters.copyWith(installation: !filters.installation),
      ),
      (
        l10n.homeFilterTopRated,
        filters.topRated,
        () => filters.copyWith(topRated: !filters.topRated),
      ),
    ];
    // Wraps onto a second line on a phone, so no chip is cut off the edge.
    return Padding(
      key: const ValueKey('home-product-controls'),
      padding: padding,
      child: Wrap(
        spacing: AppSpacing.s8,
        runSpacing: AppSpacing.s8,
        children: [
          _SortButton(sort: sort, onChanged: onSortChanged),
          for (final chip in chips)
            _FilterChip(
              label: chip.$1,
              selected: chip.$2,
              onTap: () => onFiltersChanged(chip.$3()),
            ),
        ],
      ),
    );
  }
}

String _sortLabel(BuildContext context, ProductSort sort) {
  final l10n = context.l10n;
  return switch (sort) {
    ProductSort.newest => l10n.homeSortNewest,
    ProductSort.priceLow => l10n.homeSortPriceLow,
    ProductSort.priceHigh => l10n.homeSortPriceHigh,
    ProductSort.topRated => l10n.homeSortTopRated,
  };
}

class _SortButton extends StatelessWidget {
  const _SortButton({required this.sort, required this.onChanged});

  final ProductSort sort;
  final ValueChanged<ProductSort> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return PopupMenuButton<ProductSort>(
      key: const ValueKey('home-sort-button'),
      initialValue: sort,
      onSelected: onChanged,
      tooltip: _sortLabel(context, sort),
      position: PopupMenuPosition.under,
      itemBuilder: (context) => [
        for (final option in ProductSort.values)
          PopupMenuItem(
            value: option,
            child: Text(_sortLabel(context, option)),
          ),
      ],
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s12),
        decoration: BoxDecoration(
          color: colors.bgInverse,
          borderRadius: AppRadius.fullAll,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.swap_vert_rounded,
              size: AppSize.iconMd,
              color: colors.textInverse,
            ),
            const SizedBox(width: AppSpacing.s6),
            Text(
              _sortLabel(context, sort),
              style: AppTextStyles.labelLarge.copyWith(
                color: colors.textInverse,
              ),
            ),
            const SizedBox(width: AppSpacing.s4),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              size: AppSize.iconMd,
              color: colors.textInverse,
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: selected ? colors.brandPrimarySubtle : colors.surface,
        shape: StadiumBorder(
          side: BorderSide(
            color: selected ? colors.borderFocus : colors.borderDefault,
            width: selected ? AppBorder.thick : AppBorder.thin,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
            // widthFactor keeps the chip as wide as its label inside a Wrap.
            child: Center(
              widthFactor: 1,
              child: Text(
                label,
                style: AppTextStyles.labelLarge.copyWith(
                  color: selected ? colors.textBrand : colors.textSecondary,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
