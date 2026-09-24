import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
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
    final l10n = context.l10n;
    final companyProducts =
        _getCompanyProducts(ref.watch(marketplaceProductsProvider));
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);
    final about = company.description?.trim() ?? '';
    final phone = company.phone?.trim() ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Text(company.name),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppCard(
                  padding: const EdgeInsets.all(AppSpacing.s16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AppImageTile(
                            imageUrl: company.logoUrl,
                            fallbackText:
                                company.name.isNotEmpty ? company.name : 'C',
                            size: 64,
                            radius: AppRadius.md,
                          ),
                          const SizedBox(width: AppSpacing.s16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(company.name, style: AppTextStyles.h3),
                                const SizedBox(height: AppSpacing.s4),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.star_rounded,
                                      color: AppColors.warning,
                                      size: AppSize.iconMd,
                                    ),
                                    const SizedBox(width: AppSpacing.s4),
                                    Text(
                                      company.rating.toStringAsFixed(1),
                                      style: AppTextStyles.captionStrong,
                                    ),
                                    const SizedBox(width: AppSpacing.s6),
                                    Flexible(
                                      child: Text(
                                        l10n.reviewsCount(company.reviewCount),
                                        style: AppTextStyles.caption.copyWith(
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                if (company.city != null ||
                                    company.address != null) ...[
                                  const SizedBox(height: AppSpacing.s4),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.location_on_outlined,
                                        size: AppSize.iconSm,
                                        color: AppColors.iconBrand,
                                      ),
                                      const SizedBox(width: AppSpacing.s4),
                                      Expanded(
                                        child: Text(
                                          company.city != null &&
                                                  company.address != null
                                              ? '${company.address}'
                                              : (company.city ??
                                                  company.address ??
                                                  ''),
                                          style: AppTextStyles.caption.copyWith(
                                            color: AppColors.textSecondary,
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
                      if (about.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.s16),
                        const Divider(height: 1),
                        const SizedBox(height: AppSpacing.s12),
                        Text(l10n.companyAbout, style: AppTextStyles.bodyStrong),
                        const SizedBox(height: AppSpacing.s4),
                        Text(about, style: AppTextStyles.body),
                      ],
                      if (company.locationText != null ||
                          company.hasCoordinates) ...[
                        const SizedBox(height: AppSpacing.s16),
                        const Divider(height: 1),
                        const SizedBox(height: AppSpacing.s12),
                        Text(
                          LocationStrings.of(context).location,
                          style: AppTextStyles.bodyStrong,
                        ),
                        const SizedBox(height: AppSpacing.s8),
                        // Exact map action only when coordinates exist; a
                        // text-only company just shows its written location.
                        CompanyLocationBlock(
                          text: company.locationText,
                          coordinates: company.coordinates,
                          actionLabel: LocationStrings.of(context).viewOnMap,
                          viewerTitle: company.name,
                        ),
                      ],
                      if (phone.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.s12),
                        Row(
                          children: [
                            const Icon(
                              Icons.phone_outlined,
                              size: AppSize.iconSm,
                              color: AppColors.iconBrand,
                            ),
                            const SizedBox(width: AppSpacing.s6),
                            Text(
                              phone,
                              textDirection: TextDirection.ltr,
                              style: AppTextStyles.body,
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.s24),
                Text(
                  l10n.companyProductsCount(companyProducts.length),
                  style: AppTextStyles.h3,
                ),
                const SizedBox(height: AppSpacing.s12),
                if (companyProducts.isEmpty)
                  AppEmptyState(
                    icon: Icons.inventory_2_outlined,
                    message: l10n.companyNoProducts,
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
                          const SizedBox(height: AppSpacing.s12),
                      ],
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
