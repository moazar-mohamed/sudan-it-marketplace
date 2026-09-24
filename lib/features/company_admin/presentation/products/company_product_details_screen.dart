import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/product_price_strings.dart';
import '../company_admin_actions.dart';
import '../company_admin_format.dart';
import '../widgets/admin_section_card.dart';
import 'product_form_screen.dart';
import '../../../../core/localization/l10n_extension.dart';

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
    final confirmed = await showConfirmationDialog(
      context,
      title: context.l10n.adminDeleteProduct,
      body: context.l10n.adminDeleteProductBody(product.name),
      confirmLabel: context.l10n.commonDelete,
      destructive: true,
    );
    if (!confirmed || !mounted) {
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
      showAppSnackBar(context, error, tone: AppTone.error);
      return;
    }
    showAppSnackBar(
      context,
      context.l10n.adminProductDeleted,
      tone: AppTone.success,
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
          product?.name ?? context.l10n.adminProductDetails,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          if (product != null) ...[
            IconButton(
              tooltip: context.l10n.adminEditProductTooltip,
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
              tooltip: context.l10n.adminDeleteProduct,
              icon: _isDeleting
                  ? const AppSpinner(size: 20)
                  : const Icon(Icons.delete_outline),
              onPressed: _isDeleting ? null : () => _confirmDelete(product),
            ),
          ],
        ],
      ),
      body: productsAsync.isLoading && product == null
          ? const AppLoadingState()
          : product == null
              ? AdminErrorState(message: context.l10n.adminProductNotFound)
              : _ProductDetailsBody(product: product),
    );
  }
}

class _ProductDetailsBody extends StatelessWidget {
  const _ProductDetailsBody({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppCenteredList(
      bottomPadding: AppSpacing.s32,
      children: [
        AppImageTile(
          imageUrl: product.imageUrl,
          fallbackIcon: Icons.inventory_2_outlined,
          size: 200,
          radius: AppRadius.lg,
          expand: true,
        ),
        const SizedBox(height: AppSpacing.s16),
        Text(product.name, style: AppTextStyles.h2),
        const SizedBox(height: AppSpacing.s4),
        Text(
          product.price == null
              ? ProductPriceStrings.priceOnRequest(context)
              : CompanyAdminFormat.price(product.price!, product.currency),
          style: product.price == null
              ? AppTextStyles.h2.copyWith(color: AppColors.textSecondary)
              : AppTextStyles.stat.copyWith(color: AppColors.textBrand),
        ),
        const SizedBox(height: AppSpacing.s16),
        AdminSectionCard(
          title: l10n.adminAvailability,
          children: [
            AdminInfoRow(
              label: l10n.adminStatus,
              value: product.isAvailable
                  ? l10n.adminAvailable
                  : product.hasStock
                      ? l10n.adminUnavailable
                      : l10n.adminOutOfStock,
              valueColor: product.isAvailable
                  ? AppColors.successText
                  : AppColors.errorText,
            ),
            AdminInfoRow(label: l10n.adminStock, value: '${product.stockCount}'),
          ],
        ),
        const SizedBox(height: AppSpacing.s12),
        AdminSectionCard(
          title: l10n.adminDeliveryInstallation,
          children: [
            AdminInfoRow(
              label: l10n.checkoutDelivery,
              value: product.isDeliveryAvailable
                  ? l10n.adminAvailable
                  : l10n.adminNotAvailablePickup,
            ),
            AdminInfoRow(
              label: l10n.pendingInstallation,
              value: product.isInstallationAvailable
                  ? l10n.adminAvailable
                  : l10n.adminNotAvailable,
            ),
            if (product.isInstallationAvailable)
              AdminInfoRow(
                label: l10n.adminInstallationPrice,
                value: CompanyAdminFormat.price(
                  product.installationPrice ?? 0,
                  product.currency,
                ),
              ),
          ],
        ),
        if ((product.description ?? '').trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s12),
          AdminSectionCard(
            title: l10n.productDescription,
            children: [Text(product.description!, style: AppTextStyles.body)],
          ),
        ],
        if (product.specifications.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s12),
          AdminSectionCard(
            title: l10n.productSpecifications,
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
