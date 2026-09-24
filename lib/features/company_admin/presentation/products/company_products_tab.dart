import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/arabic_text.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/product_price_strings.dart';
import '../company_admin_format.dart';
import '../widgets/admin_network_image.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/status_badge.dart';
import 'company_product_details_screen.dart';
import 'product_form_screen.dart';
import '../../../../core/localization/l10n_extension.dart';

class CompanyProductsTab extends ConsumerStatefulWidget {
  const CompanyProductsTab({super.key, required this.companyId});

  final String companyId;

  @override
  ConsumerState<CompanyProductsTab> createState() => _CompanyProductsTabState();
}

/// Filter value for "no category"; real category ids are never empty.
const _uncategorized = '';

class _CompanyProductsTabState extends ConsumerState<CompanyProductsTab> {
  String _query = '';

  /// null shows every product; [_uncategorized] the products without a
  /// category; otherwise only that category's products.
  String? _categoryFilter;

  void _openAdd() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProductFormScreen.add(companyId: widget.companyId),
      ),
    );
  }

  Widget _chip(String label, String? value) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: _categoryFilter == value,
        onSelected: (_) => setState(() => _categoryFilter = value),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final companyId = widget.companyId;
    final productsAsync = ref.watch(companyProductsStreamProvider(companyId));
    final categoryNames = ref.watch(categoryNamesProvider);

    return productsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => AdminErrorState(
        message: context.l10n.adminProductsLoadFailed,
        onRetry: () => ref.invalidate(companyProductsStreamProvider(companyId)),
      ),
      data: (products) {
        if (products.isEmpty) {
          return ListView(
            children: [
              AdminEmptyState(
                icon: Icons.inventory_2_outlined,
                message: context.l10n.adminProductsEmpty,
                action: FilledButton.icon(
                  icon: const Icon(Icons.add),
                  label: Text(context.l10n.adminAddProduct),
                  onPressed: _openAdd,
                ),
              ),
            ],
          );
        }
        final usedCategoryIds = {
          for (final product in products)
            if (product.categoryId != null &&
                categoryNames.containsKey(product.categoryId))
              product.categoryId!,
        };
        final hasUncategorized =
            products.any((product) => product.categoryId == null);
        // A filter whose products are all gone falls back to "All".
        final filter = _categoryFilter == null ||
                (_categoryFilter == _uncategorized && hasUncategorized) ||
                usedCategoryIds.contains(_categoryFilter)
            ? _categoryFilter
            : null;
        final query = normalizeSearchText(_query);
        final visible = products.where((product) {
          if (filter == _uncategorized && product.categoryId != null) {
            return false;
          }
          if (filter != null &&
              filter != _uncategorized &&
              product.categoryId != filter) {
            return false;
          }
          return query.isEmpty ||
              normalizeSearchText(product.name).contains(query);
        }).toList();

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    onChanged: (value) => setState(() => _query = value),
                    decoration: InputDecoration(
                      hintText: context.l10n.adminSearchProducts,
                      prefixIcon: const Icon(Icons.search),
                      filled: true,
                      fillColor: Theme.of(context).colorScheme.surface,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filled(
                  tooltip: context.l10n.adminAddProduct,
                  icon: const Icon(Icons.add),
                  onPressed: _openAdd,
                ),
              ],
            ),
            if (usedCategoryIds.isNotEmpty || hasUncategorized) ...[
              const SizedBox(height: 10),
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _chip(context.l10n.homeFilterAllCategories, null),
                    for (final id in usedCategoryIds)
                      _chip(categoryNames[id]!, id),
                    if (hasUncategorized)
                      _chip(
                        context.l10n.adminProductUncategorized,
                        _uncategorized,
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (visible.isEmpty)
              AdminEmptyState(
                icon: Icons.search_off_outlined,
                message: context.l10n.homeNoProducts,
              )
            else
              for (final product in visible) ...[
                _CompanyProductTile(
                  product: product,
                  categoryName: categoryNames[product.categoryId],
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => CompanyProductDetailsScreen(
                        companyId: companyId,
                        productId: product.id,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
          ],
        );
      },
    );
  }
}

class _CompanyProductTile extends StatelessWidget {
  const _CompanyProductTile({
    required this.product,
    required this.onTap,
    this.categoryName,
  });

  final Product product;
  final VoidCallback onTap;
  final String? categoryName;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;

    return Material(
      color: colorScheme.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: colorScheme.onSurface.withValues(alpha: 0.08),
            ),
          ),
          child: Row(
            children: [
              AdminNetworkImage(
                url: product.imageUrl,
                fallbackIcon: Icons.inventory_2_outlined,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (categoryName != null && categoryName!.trim().isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        categoryName!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.labelMedium?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    const SizedBox(height: 4),
                    Text(
                      product.price == null
                          ? ProductPriceStrings.priceOnRequest(context)
                          : CompanyAdminFormat.price(
                              product.price!,
                              product.currency,
                            ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        StatusBadge(
                          label: product.isAvailable
                              ? context.l10n.adminInStock(product.stockCount)
                              : product.hasStock
                                  ? context.l10n.adminUnavailable
                                  : context.l10n.adminOutOfStock,
                          color: product.isAvailable
                              ? AppColors.success
                              : AppColors.error,
                        ),
                        if (product.isInstallationAvailable)
                          StatusBadge(
                            label: context.l10n.adminInstallationBadge,
                            color: AppColors.primary,
                          ),
                        if (!product.isDeliveryAvailable)
                          StatusBadge(
                            label: context.l10n.adminPickupOnlyBadge,
                            color: Colors.deepOrange,
                          ),
                        // Legacy products have no category yet; nudge the
                        // company to pick one.
                        if (product.categoryId == null)
                          StatusBadge(
                            label: context.l10n.adminProductUncategorized,
                            color: Colors.orange,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: colorScheme.onSurface.withValues(alpha: 0.35),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
