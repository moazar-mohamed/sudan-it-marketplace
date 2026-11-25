import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../categories/presentation/category_label.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../cities/domain/sudan_city.dart';
import '../../../cities/presentation/city_tags.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../companies/presentation/company_details_screen.dart';
import '../../../favorites/domain/favorite.dart';
import '../../../favorites/presentation/favorite_button.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/product_details_screen.dart';
import '../../../reviews/domain/review.dart';
import '../../../services/presentation/service_details_screen.dart';
import '../widgets/home_service_view.dart';
import 'site_compare.dart';
import 'site_detail_parts.dart';
import 'site_look.dart';

/// The cards of sictm.net (`ProductCard`, `ServiceCard`, `CompanyCard` and the
/// home's category card), in the app.

void _push(BuildContext context, Widget screen) {
  Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
}

/// A company's city in the reader's language when it is one of the list's
/// cities (spaces and hamza ignored), else as the company wrote it.
String siteCityText(BuildContext context, String? raw) {
  final text = (raw ?? '').trim();
  if (text.isEmpty) return '';
  String fold(String s) =>
      s.replaceAll(' ', '').replaceAll(RegExp('[أإآ]'), 'ا').toLowerCase();
  final wanted = fold(text);
  final language = Localizations.localeOf(context).languageCode;
  for (final city in sudanCities) {
    if (fold(city.nameAr) == wanted || fold(city.nameEn) == wanted) {
      return city.name(language);
    }
  }
  return text;
}

/// Products added in the last 14 days are «جديد», as on the site.
bool siteIsNewProduct(Product product, [DateTime? now]) {
  final created = product.createdAt;
  if (created == null) return false;
  return (now ?? DateTime.now()).difference(created) <=
      const Duration(days: 14);
}

/// A product card (`.pcard`): the picture with the heart, the offer or «جديد»
/// badge and the category, then the name, a line of description, the company
/// and city, the price with the stars, the delivery / installation tags and
/// the city label.
class SiteProductCard extends ConsumerWidget {
  const SiteProductCard({
    super.key,
    required this.product,
    this.highlight,
    this.list = false,
  });

  final Product product;

  /// Words to mark in the name (a search).
  final String? highlight;

  /// One per line (`.pcards.list`): the picture on the side, no category label.
  final bool list;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final l10n = context.l10n;
    final p = product;
    final category = ref.watch(categoriesByIdProvider)[p.categoryId];
    final company = ref
        .watch(marketplaceCompaniesProvider)
        .where((c) => c.id == p.companyId)
        .firstOrNull;
    final city = siteCityText(context, company?.city);
    final color = siteCategoryColor(category, p.id);
    final image = (p.imageUrl ?? '').trim();
    final description = (p.description ?? '').trim();

    final picture = ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: list ? null : 170,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (image.isNotEmpty)
              AppNetworkImage(
                url: image,
                fit: BoxFit.cover,
                fallback: ColoredBox(color: colors.bgSubtle),
              )
            else
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [color, color.withValues(alpha: 0.7)],
                  ),
                ),
                child: Center(
                  child: SiteGlyph(
                    emoji: siteCategoryEmoji(category, 'box'),
                    size: 56,
                  ),
                ),
              ),
            PositionedDirectional(
              top: 8,
              end: 8,
              child: FavoriteButton(
                kind: FavoriteKind.product,
                targetId: p.id,
                name: p.name,
                onImage: true,
              ),
            ),
            // Under the heart; a phone's list view has no room for it.
            if (!list)
              PositionedDirectional(
                top: 52,
                end: 8,
                child: SiteCompareButton(productId: p.id),
              ),
            if (p.hasActiveOffer || siteIsNewProduct(p))
              PositionedDirectional(
                top: 12,
                start: 12,
                child: p.hasActiveOffer
                    ? SitePill(
                        label: siteOfferLabel(context, p),
                        background: const Color(0xFFD32F2F),
                        foreground: Colors.white,
                      )
                    : SitePill(
                        label: l10n.siteNew,
                        background: colors.bgInverse,
                        foreground: colors.textInverse,
                      ),
              ),
            if (category != null && !list)
              PositionedDirectional(
                bottom: 10,
                start: 10,
                end: 10,
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: SitePill(
                    label: category.localizedName(context),
                    background: colors.surface,
                    foreground: colors.textPrimary,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HighlightedText(
          p.name,
          query: highlight,
          style: AppTextStyles.bodyStrong.copyWith(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            height: 1.5,
          ),
        ),
        if (description.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            description,
            maxLines: list ? 3 : 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.caption.copyWith(
              fontSize: 13,
              height: 1.6,
              color: colors.textSecondary,
            ),
          ),
        ],
        const SizedBox(height: 8),
        Row(
          children: [
            Icon(
              Icons.apartment_rounded,
              size: 15,
              color: colors.textSecondary,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                [
                  (p.companyName ?? '').trim(),
                  city,
                ].where((s) => s.isNotEmpty).join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
                  fontSize: 13,
                  color: colors.textSecondary,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: SitePriceText(pricing: p, currency: p.currency),
            ),
            SiteRatingLine(
              ratingKey: RatingStats.keyFor('product', p.id),
              showCount: false,
              showNew: false,
            ),
          ],
        ),
        if (p.isDeliveryAvailable || p.isInstallationAvailable) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (p.isDeliveryAvailable)
                SitePill(
                  label: l10n.siteDelivery,
                  background: colors.bgSubtle,
                  foreground: colors.textSecondary,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 2,
                  ),
                ),
              if (p.isInstallationAvailable)
                SitePill(
                  label: l10n.siteInstallation,
                  background: colors.bgSubtle,
                  foreground: colors.textSecondary,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 2,
                  ),
                ),
            ],
          ),
        ],
        if ((p.companyId ?? '').isNotEmpty)
          CompanyCityTag(companyId: p.companyId!, spaceAbove: 8),
      ],
    );

    return SiteCard(
      key: ValueKey('site-product-${p.id}'),
      padding: EdgeInsets.all(list ? 10 : 12),
      onTap: () => _push(context, ProductDetailsScreen(product: p)),
      child: list
          ? IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    width: 112,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 120),
                      child: picture,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: body,
                    ),
                  ),
                ],
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                picture,
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 14, 8, 8),
                  child: body,
                ),
              ],
            ),
    );
  }
}

/// A company's logo, else its first letter in white on a colour that stays
/// the same for it (`CompanyLogo`).
class SiteCompanyLogo extends StatelessWidget {
  const SiteCompanyLogo({super.key, required this.company, this.size = 46});

  final Company company;
  final double size;

  @override
  Widget build(BuildContext context) {
    final logo = (company.logoUrl ?? '').trim();
    final letter = company.name.trim().isEmpty
        ? '?'
        : company.name.trim().characters.first;
    final letterBox = ColoredBox(
      color: siteCategoryColor(null, company.id),
      child: Center(
        child: Text(
          letter,
          style: AppTextStyles.h2.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: size * 0.4,
          ),
        ),
      ),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: size,
        height: size,
        child: logo.isEmpty
            ? letterBox
            : AppNetworkImage(
                url: logo,
                fit: BoxFit.cover,
                fallback: letterBox,
              ),
      ),
    );
  }
}

/// A company card (`.ccard`): the logo, the name, the city and how many items
/// it lists, its rating pill and the city label.
class SiteCompanyCard extends StatelessWidget {
  const SiteCompanyCard({
    super.key,
    required this.company,
    required this.itemCount,
    this.highlight,
  });

  final Company company;
  final int itemCount;
  final String? highlight;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final where = [
      siteCityText(context, company.city),
      if (itemCount > 0) context.l10n.siteItemsCount(itemCount),
    ].where((s) => s.isNotEmpty).join(' · ');
    return SiteCard(
      key: ValueKey('site-company-${company.id}'),
      onTap: () => _push(context, CompanyDetailsScreen(company: company)),
      child: Row(
        children: [
          SiteCompanyLogo(company: company, size: 56),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                HighlightedText(
                  company.name,
                  query: highlight,
                  style: AppTextStyles.bodyStrong.copyWith(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (where.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      where,
                      style: AppTextStyles.caption.copyWith(
                        fontSize: 13,
                        color: colors.textSecondary,
                      ),
                    ),
                  ),
                SiteRatingLine(
                  ratingKey: RatingStats.keyFor('company', company.id),
                  fallbackAverage: company.rating,
                  fallbackCount: company.reviewCount,
                  pill: true,
                ),
                CompanyCityTag(companyId: company.id, spaceAbove: 8),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A service card (`.scard`): the category's picture on its tint, the name,
/// its category and the companies performing it, then the discount and what
/// it starts from, and the heart.
class SiteServiceCard extends ConsumerWidget {
  const SiteServiceCard({super.key, required this.listing, this.highlight});

  final ServiceListing listing;
  final String? highlight;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final l10n = context.l10n;
    final service = listing.service;
    final Category? category = ref.watch(
      categoriesByIdProvider,
    )[service.categoryId];
    final color = siteCategoryColor(category, service.id);
    final company = listing.leadCompany;
    final others = listing.otherCompanies;
    final from = listing.startsFrom;
    final discount = listing.bestDiscount;

    return SiteCard(
      key: ValueKey('site-service-${service.id}'),
      onTap: () => _push(context, ServiceDetailsScreen(service: service)),
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 40),
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 16,
              runSpacing: 12,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  alignment: Alignment.center,
                  child: SiteGlyph(
                    emoji: siteCategoryEmoji(category, 'service'),
                    size: 28,
                  ),
                ),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 220),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      HighlightedText(
                        service.name,
                        query: highlight,
                        style: AppTextStyles.bodyStrong.copyWith(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (category != null)
                        Text(
                          category.localizedName(context),
                          style: AppTextStyles.captionStrong.copyWith(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: colors.textBrand,
                          ),
                        ),
                      if (company != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            company.name +
                                (others > 0
                                    ? l10n.siteAndOtherCompanies(others)
                                    : ''),
                            style: AppTextStyles.caption.copyWith(
                              fontSize: 13,
                              color: colors.textSecondary,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (discount > 0)
                      SitePill(
                        label: l10n.siteDiscount(discount),
                        background: colors.warningSubtle,
                        foreground: colors.warningText,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 2,
                        ),
                      ),
                    if (from != null) ...[
                      const SizedBox(height: 4),
                      Text.rich(
                        TextSpan(
                          text: '${l10n.siteStartsFrom} ',
                          style: AppTextStyles.caption.copyWith(
                            fontSize: 13,
                            color: colors.textSecondary,
                          ),
                          children: [
                            TextSpan(
                              text: sitePrice(context, from),
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: colors.price,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ] else if (listing.offers.isNotEmpty)
                      Text(
                        l10n.sitePriceOnRequest,
                        style: AppTextStyles.bodyStrong.copyWith(
                          fontWeight: FontWeight.w700,
                          color: colors.textSecondary,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          PositionedDirectional(
            top: -8,
            end: -8,
            child: FavoriteButton(
              kind: FavoriteKind.service,
              targetId: service.id,
              name: service.name,
            ),
          ),
        ],
      ),
    );
  }
}

/// A main category on the home (`.cat-card`): its picture in a light blue
/// square, its name and how many items it holds.
class SiteCategoryCard extends ConsumerWidget {
  const SiteCategoryCard({
    super.key,
    required this.category,
    required this.count,
    this.onOpen,
  });

  final Category category;
  final int count;

  /// Opens the category in the products page; without it, the customer app
  /// is asked for that page (`siteOpenShop`).
  final ValueChanged<String>? onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    return SiteCard(
      key: ValueKey('site-category-${category.id}'),
      radius: 16,
      padding: const EdgeInsets.fromLTRB(4, 12, 4, 12),
      onTap: () => onOpen != null
          ? onOpen!(category.id)
          : siteOpenShop(context, ref, categoryId: category.id),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: colors.brandPrimarySubtle,
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: SiteGlyph(emoji: siteCategoryEmoji(category), size: 26),
          ),
          const SizedBox(height: 8),
          Text(
            category.localizedName(context),
            textAlign: TextAlign.center,
            style: AppTextStyles.captionStrong.copyWith(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
          if (count > 0)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                context.l10n.siteItemsCount(count),
                textAlign: TextAlign.center,
                style: AppTextStyles.caption.copyWith(
                  fontSize: 12,
                  color: colors.textSecondary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
