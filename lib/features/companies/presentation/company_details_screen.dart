import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/phone_number.dart';
import '../../cities/presentation/city_tags.dart';
import '../../customer_dashboard/presentation/site/site_cards.dart';
import '../../customer_dashboard/presentation/site/site_detail_parts.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../../location/presentation/location_viewer_screen.dart';
import '../../products/domain/entities/product.dart';
import '../../products/presentation/products_providers.dart';
import '../domain/entities/company.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../reviews/domain/review.dart';
import '../../reviews/presentation/reviews_providers.dart';
import '../../../core/widgets/back_to_top.dart';

/// A company's page as on sictm.net (`pages/CompanyPage.tsx`): a tile with
/// the logo, the name, the stars, the address, the phone, «عرض على الخريطة»
/// and the city label; then «نبذة عن الشركة», the reviews and its products.
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
    final colors = context.colors;
    final companyProducts =
        _getCompanyProducts(ref.watch(marketplaceProductsProvider));
    final about = company.description?.trim() ?? '';
    final address = company.address?.trim() ?? '';
    final city = siteCityText(context, company.city);
    final place = address.isNotEmpty ? address : city;
    final phone = displayPhone(company.phone);
    final rawPhone = company.phone?.trim() ?? '';
    final point = company.coordinates;
    final facts = AppTextStyles.body.copyWith(
      fontSize: 14,
      color: colors.textSecondary,
    );

    return Scaffold(
      appBar: AppBar(),
      body: BackToTop(child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SiteTile(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SiteCompanyLogo(company: company, size: 88),
                      const SizedBox(width: 20),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Semantics(
                              header: true,
                              child: Text(
                                company.name,
                                style: AppTextStyles.h1.copyWith(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            SiteRatingLine(
                              ratingKey: RatingStats.keyFor(
                                'company',
                                company.id,
                              ),
                              fallbackAverage: company.rating,
                              fallbackCount: company.reviewCount,
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 20,
                              runSpacing: 8,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                if (place.isNotEmpty)
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.location_on_outlined,
                                        size: 18,
                                        color: colors.textSecondary,
                                      ),
                                      const SizedBox(width: 4),
                                      Flexible(
                                        child: Text(place, style: facts),
                                      ),
                                    ],
                                  ),
                                if (phone.isNotEmpty)
                                  InkWell(
                                    key: const ValueKey('company-phone'),
                                    onTap: rawPhone.isEmpty
                                        ? null
                                        : () => launchUrl(
                                            Uri(scheme: 'tel', path: rawPhone),
                                          ),
                                    child: Text(
                                      phone,
                                      textDirection: TextDirection.ltr,
                                      style: facts,
                                    ),
                                  ),
                                if (point != null)
                                  InkWell(
                                    key: const ValueKey('company-map'),
                                    onTap: () => Navigator.of(context).push(
                                      MaterialPageRoute<void>(
                                        builder: (_) => LocationViewerScreen(
                                          title: company.name,
                                          location: point,
                                          addressText: company.locationText,
                                        ),
                                      ),
                                    ),
                                    child: Text(
                                      l10n.siteViewOnMap,
                                      style: facts.copyWith(
                                        fontWeight: FontWeight.w700,
                                        color: colors.textBrand,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            CompanyCityTag(
                              companyId: company.id,
                              spaceAbove: 8,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (about.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  SiteProseTile(title: l10n.companyAbout, text: about),
                ],
                SiteReviews(provider: companyPublicReviewsProvider(company.id)),
                const SizedBox(height: 16),
                SiteSectionTitle(
                  title: l10n.companyProductsCount(companyProducts.length),
                ),
                if (companyProducts.isEmpty)
                  SiteEmptyState(title: l10n.companyNoProducts)
                else
                  for (int i = 0; i < companyProducts.length; i++) ...[
                    if (i > 0) const SizedBox(height: 16),
                    SiteProductCard(product: companyProducts[i]),
                  ],
              ],
            ),
          ),
        ),
      )),
    );
  }
}
