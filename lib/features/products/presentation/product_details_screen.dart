import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../companies/domain/entities/company.dart';
import '../../companies/presentation/company_details_screen.dart';
import '../../customer_dashboard/data/mock_marketplace_data.dart';
import '../../orders/presentation/checkout_screen.dart';
import '../domain/entities/product.dart';

class ProductDetailsScreen extends StatefulWidget {
  const ProductDetailsScreen({
    super.key,
    required this.product,
    this.openedFromCompany = false,
  });

  final Product product;
  final bool openedFromCompany;

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  int _quantity = 1;

  String _formatPrice(double price) {
    final parts = price.toStringAsFixed(0).split('.');
    final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return parts[0].replaceAllMapped(regExp, (Match m) => '${m[1]},');
  }

  Company? _resolveCompany() {
    for (final company in mockCompanies) {
      if (widget.product.companyId != null &&
          company.id == widget.product.companyId) {
        return company;
      }
      if (widget.product.companyName != null &&
          company.name.toLowerCase() ==
              widget.product.companyName!.toLowerCase()) {
        return company;
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
    if (_quantity > 1) {
      setState(() => _quantity--);
    }
  }

  void _incrementQuantity() {
    if (_quantity < widget.product.stockCount) {
      setState(() => _quantity++);
    }
  }

  void _onBuyNow(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CheckoutScreen(
          product: widget.product,
          quantity: _quantity,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final matchedCompany = _resolveCompany();
    final totalPrice = widget.product.price * _quantity;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.product.name),
      ),
      body: SingleChildScrollView(
        scrollDirection: Axis.vertical,
        physics: const ClampingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: SizedBox(
          width: double.infinity,
          child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Large Product Image Container
            Container(
              height: 240,
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.secondary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.secondary.withValues(alpha: 0.15),
                ),
              ),
              child: Stack(
                children: [
                  const Center(
                    child: Icon(
                      Icons.inventory_2_outlined,
                      size: 88,
                      color: AppColors.primary,
                    ),
                  ),
                  Positioned(
                    top: 14,
                    left: 14,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: widget.product.isAvailable
                            ? AppColors.success.withValues(alpha: 0.12)
                            : AppColors.error.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: widget.product.isAvailable
                              ? AppColors.success
                              : AppColors.error,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            widget.product.isAvailable
                                ? Icons.check_circle_rounded
                                : Icons.cancel_rounded,
                            size: 14,
                            color: widget.product.isAvailable
                                ? AppColors.success
                                : AppColors.error,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            widget.product.isAvailable
                                ? 'In Stock (${widget.product.stockCount})'
                                : 'Out of Stock',
                            style: textTheme.labelSmall?.copyWith(
                              color: widget.product.isAvailable
                                  ? AppColors.success
                                  : AppColors.error,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            // Product Name
            Text(
              widget.product.name,
              style: textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
                color: colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            // Price
            Text(
              '${_formatPrice(widget.product.price)} ${widget.product.currency}',
              style: textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 16),
            // Seller / Company Section
            if (matchedCompany != null ||
                (widget.product.companyName != null &&
                    widget.product.companyName!.isNotEmpty)) ...[
              Material(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  onTap: matchedCompany != null
                      ? () => _onViewCompany(context, matchedCompany)
                      : null,
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: colorScheme.onSurface.withValues(alpha: 0.08),
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color:
                                  AppColors.primary.withValues(alpha: 0.15),
                            ),
                          ),
                          child: Center(
                            child: Text(
                              (widget.product.companyName != null &&
                                      widget.product.companyName!.isNotEmpty)
                                  ? widget.product.companyName![0]
                                      .toUpperCase()
                                  : 'C',
                              style: textTheme.titleMedium?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.product.companyName ??
                                    matchedCompany?.name ??
                                    'Verified Seller',
                                style: textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: colorScheme.onSurface,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (matchedCompany != null) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.star_rounded,
                                      color: Colors.amber,
                                      size: 16,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      matchedCompany.rating
                                          .toStringAsFixed(1),
                                      style: textTheme.bodySmall?.copyWith(
                                        fontWeight: FontWeight.w700,
                                        color: colorScheme.onSurface,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      '(${matchedCompany.reviewCount} reviews)',
                                      style: textTheme.bodySmall?.copyWith(
                                        color: colorScheme.onSurface
                                            .withValues(alpha: 0.6),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                        if (matchedCompany != null) ...[
                          Flexible(
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Flexible(
                                  child: Text(
                                    'View Company',
                                    overflow: TextOverflow.ellipsis,
                                    style: textTheme.bodySmall?.copyWith(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(
                                  Icons.arrow_forward_ios_rounded,
                                  size: 12,
                                  color: AppColors.primary,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            // Installation Info (Only shown if isInstallationAvailable is true)
            if (widget.product.isInstallationAvailable) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.secondary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: AppColors.secondary.withValues(alpha: 0.25),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.handyman_outlined,
                      color: AppColors.primary,
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Professional Installation Available',
                            style: textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Installation price: ${_formatPrice(widget.product.installationPrice ?? 0)} ${widget.product.currency}. On-site setup option is selected during checkout.',
                            style: textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurface
                                  .withValues(alpha: 0.8),
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
            // Description
            if (widget.product.description != null &&
                widget.product.description!.isNotEmpty) ...[
              Text(
                'Description',
                style: textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                widget.product.description!,
                style: textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.8),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 20),
            ],
            // Specifications
            if (widget.product.specifications.isNotEmpty) ...[
              Text(
                'Specifications',
                style: textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 10),
              Container(
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: colorScheme.onSurface.withValues(alpha: 0.08),
                  ),
                ),
                child: Column(
                  children: [
                    for (int i = 0;
                        i < widget.product.specifications.entries.length;
                        i++) ...[
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 11,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 110,
                              child: Text(
                                widget.product.specifications.entries
                                    .elementAt(i)
                                    .key,
                                style: textTheme.bodySmall?.copyWith(
                                  color: colorScheme.onSurface
                                      .withValues(alpha: 0.6),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                widget.product.specifications.entries
                                    .elementAt(i)
                                    .value,
                                style: textTheme.bodySmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: colorScheme.onSurface,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (i < widget.product.specifications.entries.length - 1)
                        Divider(
                          height: 1,
                          color: colorScheme.onSurface.withValues(alpha: 0.06),
                        ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ],
          ),
        ),
      ),
      // Sticky Bottom Navigation for Quantity Selector & Buy Now Button
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          border: Border(
            top: BorderSide(
              color: colorScheme.onSurface.withValues(alpha: 0.08),
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          child: Row(
            children: [
              // Quantity Counter (− quantity +)
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: colorScheme.onSurface.withValues(alpha: 0.15),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    InkWell(
                      onTap: _decrementQuantity,
                      borderRadius: const BorderRadius.horizontal(
                        left: Radius.circular(9),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        child: Icon(
                          Icons.remove,
                          size: 18,
                          color: _quantity > 1
                              ? colorScheme.onSurface
                              : colorScheme.onSurface.withValues(alpha: 0.3),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text(
                        '$_quantity',
                        style: textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: _incrementQuantity,
                      borderRadius: const BorderRadius.horizontal(
                        right: Radius.circular(9),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        child: Icon(
                          Icons.add,
                          size: 18,
                          color: _quantity < widget.product.stockCount
                              ? colorScheme.onSurface
                              : colorScheme.onSurface.withValues(alpha: 0.3),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              // Buy Now Button
              Expanded(
                child: ElevatedButton(
                  onPressed: widget.product.isAvailable
                      ? () => _onBuyNow(context)
                      : null,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                  child: Text(
                    'Buy Now • ${_formatPrice(totalPrice)} ${widget.product.currency}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
