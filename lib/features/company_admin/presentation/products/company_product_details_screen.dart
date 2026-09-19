import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/product_price_strings.dart';
import '../company_admin_actions.dart';
import '../company_admin_format.dart';
import '../widgets/admin_network_image.dart';
import '../widgets/admin_section_card.dart';
import 'product_form_screen.dart';

class CompanyProductDetailsScreen extends ConsumerStatefulWidget {
  const CompanyProductDetailsScreen({
    super.key,
    required this.companyId,
    required this.productId,
  });

  final String companyId;
  final String productId;

  @override
  ConsumerState<CompanyProductDetailsScreen> createState() =>
      _CompanyProductDetailsScreenState();
}

class _CompanyProductDetailsScreenState
    extends ConsumerState<CompanyProductDetailsScreen> {
  bool _isDeleting = false;

  Product? _findProduct(List<Product>? products) {
    for (final item in products ?? const <Product>[]) {
      if (item.id == widget.productId) {
        return item;
      }
    }
    return null;
  }

  Future<void> _confirmDelete(Product product) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete product'),
        content: Text(
          'Delete "${product.name}"? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }

    setState(() => _isDeleting = true);
    final error =
        await ref.read(companyAdminActionsProvider).deleteProduct(product.id);
    if (!mounted) {
      return;
    }
    setState(() => _isDeleting = false);

    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: AppColors.error),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Product deleted.')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final productsAsync =
        ref.watch(companyProductsStreamProvider(widget.companyId));
    final product = _findProduct(productsAsync.asData?.value);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          product?.name ?? 'Product Details',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          if (product != null) ...[
            IconButton(
              tooltip: 'Edit product',
              icon: const Icon(Icons.edit_outlined),
              onPressed: _isDeleting
                  ? null
                  : () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              ProductFormScreen.edit(product: product),
                        ),
                      ),
            ),
            IconButton(
              tooltip: 'Delete product',
              icon: _isDeleting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(Icons.delete_outline, color: AppColors.error),
              onPressed: _isDeleting ? null : () => _confirmDelete(product),
            ),
          ],
        ],
      ),
      body: productsAsync.isLoading && product == null
          ? const Center(child: CircularProgressIndicator())
          : product == null
              ? const AdminErrorState(message: 'This product was not found.')
              : _ProductDetailsBody(product: product),
    );
  }
}

class _ProductDetailsBody extends StatelessWidget {
  const _ProductDetailsBody({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Center(
          child: AdminNetworkImage(
            url: product.imageUrl,
            fallbackIcon: Icons.inventory_2_outlined,
            size: 160,
            radius: 16,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          product.name,
          style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          product.price == null
              ? ProductPriceStrings.priceOnRequest(context)
              : CompanyAdminFormat.price(product.price!, product.currency),
          style: textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w800,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(height: 16),
        AdminSectionCard(
          title: 'Availability',
          children: [
            AdminInfoRow(
              label: 'Status',
              value: product.isAvailable
                  ? 'Available'
                  : product.hasStock
                      ? 'Unavailable'
                      : 'Out of stock',
              valueColor:
                  product.isAvailable ? AppColors.success : AppColors.error,
            ),
            AdminInfoRow(label: 'Stock', value: '${product.stockCount}'),
          ],
        ),
        const SizedBox(height: 12),
        AdminSectionCard(
          title: 'Delivery & Installation',
          children: [
            AdminInfoRow(
              label: 'Delivery',
              value: product.isDeliveryAvailable
                  ? 'Available'
                  : 'Not available (pickup only)',
            ),
            AdminInfoRow(
              label: 'Installation',
              value: product.isInstallationAvailable ? 'Available' : 'Not available',
            ),
            if (product.isInstallationAvailable)
              AdminInfoRow(
                label: 'Installation Price',
                value: CompanyAdminFormat.price(
                  product.installationPrice ?? 0,
                  product.currency,
                ),
              ),
          ],
        ),
        if ((product.description ?? '').trim().isNotEmpty) ...[
          const SizedBox(height: 12),
          AdminSectionCard(
            title: 'Description',
            children: [
              Text(product.description!, style: textTheme.bodyMedium),
            ],
          ),
        ],
        if (product.specifications.isNotEmpty) ...[
          const SizedBox(height: 12),
          AdminSectionCard(
            title: 'Specifications',
            children: [
              for (final entry in product.specifications.entries)
                AdminInfoRow(label: entry.key, value: entry.value),
            ],
          ),
        ],
      ],
    );
  }
}
