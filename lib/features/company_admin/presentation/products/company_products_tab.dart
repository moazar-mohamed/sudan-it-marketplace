import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/products_providers.dart';
import '../company_admin_format.dart';
import '../widgets/admin_network_image.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/status_badge.dart';
import 'company_product_details_screen.dart';
import 'product_form_screen.dart';

class CompanyProductsTab extends ConsumerWidget {
  const CompanyProductsTab({super.key, required this.companyId});

  final String companyId;

  void _openAdd(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProductFormScreen.add(companyId: companyId),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(companyProductsStreamProvider(companyId));

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'company_add_product',
        onPressed: () => _openAdd(context),
        icon: const Icon(Icons.add),
        label: const Text('Add Product'),
      ),
      body: productsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => AdminErrorState(
          message: 'Could not load your products.',
          onRetry: () =>
              ref.invalidate(companyProductsStreamProvider(companyId)),
        ),
        data: (products) {
          if (products.isEmpty) {
            return ListView(
              children: const [
                AdminEmptyState(
                  icon: Icons.inventory_2_outlined,
                  message:
                      'You have not added any products yet.\nTap "Add Product" to create your first one.',
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: products.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) => _CompanyProductTile(
              product: products[index],
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => CompanyProductDetailsScreen(
                    companyId: companyId,
                    productId: products[index].id,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _CompanyProductTile extends StatelessWidget {
  const _CompanyProductTile({required this.product, required this.onTap});

  final Product product;
  final VoidCallback onTap;

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
                    const SizedBox(height: 4),
                    Text(
                      CompanyAdminFormat.price(product.price, product.currency),
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
                              ? 'In stock: ${product.stockCount}'
                              : 'Unavailable',
                          color: product.isAvailable
                              ? AppColors.success
                              : AppColors.error,
                        ),
                        if (product.isInstallationAvailable)
                          const StatusBadge(
                            label: 'Installation',
                            color: AppColors.primary,
                          ),
                        if (!product.isDeliveryAvailable)
                          const StatusBadge(
                            label: 'Pickup only',
                            color: Colors.deepOrange,
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
