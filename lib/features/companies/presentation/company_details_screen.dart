import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../location/presentation/location_strings.dart';
import '../../location/presentation/widgets/open_location_button.dart';
import '../../products/domain/entities/product.dart';
import '../../products/presentation/products_providers.dart';
import '../../products/presentation/widgets/product_card.dart';
import '../domain/entities/company.dart';
import '../../../core/localization/l10n_extension.dart';

class CompanyDetailsScreen extends ConsumerWidget {
  const CompanyDetailsScreen({
    super.key,
    required this.company,
  });

  final Company company;

  List<Product> _getCompanyProducts(List<Product> allProducts) {
    return allProducts.where((product) {
      if (product.companyId != null && product.companyId == company.id) {
        return true;
      }
      if (product.companyName != null &&
          product.companyName!.toLowerCase() == company.name.toLowerCase()) {
        return true;
      }
      return false;
    }).toList();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final companyProducts =
        _getCompanyProducts(ref.watch(marketplaceProductsProvider));

    return Scaffold(
      appBar: AppBar(
        title: Text(company.name),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Company Header Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: colorScheme.onSurface.withValues(alpha: 0.08),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.15),
                          ),
                        ),
                        child: Center(
                          child: Text(
                            company.name.isNotEmpty
                                ? company.name.substring(0, 1).toUpperCase()
                                : 'C',
                            style: textTheme.headlineSmall?.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              company.name,
                              style: textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: colorScheme.onSurface,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(
                                  Icons.star_rounded,
                                  color: Colors.amber,
                                  size: 18,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  company.rating.toStringAsFixed(1),
                                  style: textTheme.bodySmall?.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: colorScheme.onSurface,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  context.l10n.reviewsCount(company.reviewCount),
                                  style: textTheme.bodySmall?.copyWith(
                                    color: colorScheme.onSurface
                                        .withValues(alpha: 0.6),
                                  ),
                                ),
                              ],
                            ),
                            if (company.city != null ||
                                company.address != null) ...[
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Icon(
                                    Icons.location_on_outlined,
                                    size: 16,
                                    color: colorScheme.primary,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      company.city != null &&
                                              company.address != null
                                          ? '${company.address}'
                                          : (company.city ??
                                              company.address ??
                                              ''),
                                      style: textTheme.bodySmall?.copyWith(
                                        color: colorScheme.onSurface
                                            .withValues(alpha: 0.7),
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (company.description != null &&
                      company.description!.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    const Divider(),
                    const SizedBox(height: 10),
                    Text(
                      context.l10n.companyAbout,
                      style: textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      company.description!,
                      style: textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurface.withValues(alpha: 0.8),
                        height: 1.45,
                      ),
                    ),
                  ],
                  if (company.locationText != null || company.hasCoordinates) ...[
                    const SizedBox(height: 14),
                    const Divider(),
                    const SizedBox(height: 10),
                    Text(
                      LocationStrings.of(context).location,
                      style: textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Exact map action only when coordinates exist; a
                    // text-only company just shows its written location.
                    CompanyLocationBlock(
                      text: company.locationText,
                      coordinates: company.coordinates,
                      actionLabel: LocationStrings.of(context).viewOnMap,
                      viewerTitle: company.name,
                    ),
                  ],
                  if (company.phone != null && company.phone!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(
                          Icons.phone_outlined,
                          size: 16,
                          color: colorScheme.primary,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          company.phone!,
                          style: textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurface.withValues(alpha: 0.8),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),
            // Products Section Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  context.l10n.companyProductsCount(companyProducts.length),
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onSurface,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Products Vertical List
            if (companyProducts.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24),
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: colorScheme.onSurface.withValues(alpha: 0.08),
                  ),
                ),
                child: Center(
                  child: Text(
                    context.l10n.companyNoProducts,
                    style: textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ),
              )
            else
              Column(
                children: [
                  for (int i = 0; i < companyProducts.length; i++) ...[
                    ProductCard(
                      product: companyProducts[i],
                      openedFromCompany: true,
                    ),
                    if (i < companyProducts.length - 1)
                      const SizedBox(height: 10),
                  ],
                ],
              ),
          ],
        ),
      ),
    );
  }
}
