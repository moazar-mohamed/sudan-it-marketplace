import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../../core/utils/search_ranking.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/product_price_strings.dart';
import '../company_admin_format.dart';
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

  @override
  Widget build(BuildContext context) {
    final companyId = widget.companyId;
    final productsAsync = ref.watch(companyProductsStreamProvider(companyId));
    final categoryNames = ref.watch(categoryNamesProvider);
    final categoriesById = ref.watch(categoriesByIdProvider);

    return productsAsync.when(
      loading: () => ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: const [AppSkeletonList()],
      ),
      error: (_, _) => AppErrorState(
        message: context.l10n.adminProductsLoadFailed,
        onRetry: () => ref.invalidate(companyProductsStreamProvider(companyId)),
      ),
      data: (products) {
        if (products.isEmpty) {
          return ListView(
            children: [
              AppEmptyState(
                icon: Icons.inventory_2_outlined,
                message: context.l10n.adminProductsEmpty,
                action: AppButton.primary(
                  icon: Icons.add,
                  label: context.l10n.adminAddProduct,
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
        final visible = searchRanked(
          products.where((product) {
            if (filter == _uncategorized) return product.categoryId == null;
            return filter == null || product.categoryId == filter;
          }),
          _query,
          (product) => [
            SearchField(product.name, weight: 3),
            SearchField(
              categoriesById[product.categoryId]?.searchText ?? '',
              weight: 2,
            ),
            SearchField(product.description ?? ''),
          ],
        );

        return ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.s16,
            AppSpacing.s12,
            AppSpacing.s16,
            AppSpacing.s24,
          ),
          children: [
            Row(
              children: [
                Expanded(
                  child: AppSearchField(
                    hint: context.l10n.adminSearchProducts,
                    onChanged: (value) => setState(() => _query = value),
                  ),
                ),
                const SizedBox(width: AppSpacing.s8),
                IconButton.filled(
                  style: IconButton.styleFrom(
                    foregroundColor: AppColors.onPrimary,
                  ),
                  tooltip: context.l10n.adminAddProduct,
                  icon: const Icon(Icons.add),
                  onPressed: _openAdd,
                ),
              ],
            ),
            if (usedCategoryIds.isNotEmpty || hasUncategorized) ...[
              const SizedBox(height: 10),
              AppFilterChips(
                labels: [
                  context.l10n.homeFilterAllCategories,
                  for (final id in usedCategoryIds) categoryNames[id]!,
                  if (hasUncategorized) context.l10n.adminProductUncategorized,
                ],
                selectedIndex: [
                  null,
                  ...usedCategoryIds,
                  if (hasUncategorized) _uncategorized,
                ].indexOf(_categoryFilter),
                onChanged: (index) => setState(() {
                  _categoryFilter = index == 0
                      ? null
                      : index <= usedCategoryIds.length
                          ? usedCategoryIds.elementAt(index - 1)
                          : _uncategorized;
                }),
              ),
            ],
            const SizedBox(height: 12),
            if (visible.isEmpty)
              AppEmptyState(
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
                const SizedBox(height: AppSpacing.s12),
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
    final name = categoryName?.trim() ?? '';

    return AppListCard(
      onTap: onTap,
      leading: AppImageTile(
        imageUrl: product.imageUrl,
        fallbackIcon: Icons.inventory_2_outlined,
      ),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            product.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodyStrong,
          ),
          if (name.isNotEmpty)
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.captionStrong
                  .copyWith(color: AppColors.textBrand),
            ),
          Text(
            product.price == null
                ? ProductPriceStrings.priceOnRequest(context)
                : CompanyAdminFormat.price(product.price!, product.currency),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodyStrong.copyWith(
              color: product.price == null
                  ? AppColors.textSecondary
                  : AppColors.textBrand,
            ),
          ),
          const SizedBox(height: AppSpacing.s6),
          Wrap(
            spacing: AppSpacing.s6,
            runSpacing: AppSpacing.s6,
            children: [
              StatusChip(
                label: product.isAvailable
                    ? context.l10n.adminInStock(product.stockCount)
                    : product.hasStock
                        ? context.l10n.adminUnavailable
                        : context.l10n.adminOutOfStock,
                tone: product.isAvailable ? AppTone.success : AppTone.error,
              ),
              if (product.isInstallationAvailable)
                StatusChip(
                  label: context.l10n.adminInstallationBadge,
                  tone: AppTone.brand,
                ),
              if (!product.isDeliveryAvailable)
                StatusChip(
                  label: context.l10n.adminPickupOnlyBadge,
                  tone: AppTone.progress,
                ),
              // Legacy products have no category yet; nudge the company to
              // pick one.
              if (product.categoryId == null)
                StatusChip(
                  label: context.l10n.adminProductUncategorized,
                  tone: AppTone.warning,
                ),
            ],
          ),
        ],
      ),
    );
  }
}
