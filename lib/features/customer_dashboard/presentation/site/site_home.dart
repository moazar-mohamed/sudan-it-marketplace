import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../auth/presentation/require_account.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../company_services/domain/entities/company_service.dart';
import '../../../company_services/presentation/company_service_providers.dart';
import '../../../favorites/presentation/favorites_screen.dart';
import '../../../offers/domain/offer_item.dart';
import '../../../offers/presentation/offers_providers.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/reviews_providers.dart';
import '../../../search/presentation/customer_search_screen.dart';
import '../../../services/domain/entities/catalog_service.dart';
import '../../../services/presentation/service_providers.dart';
import '../../../settings/presentation/settings_screen.dart';
import '../category_counts_provider.dart';
import '../widgets/home_service_view.dart';
import 'site_cards.dart';
import 'site_hero_offers.dart';
import 'site_look.dart';
import 'site_terms.dart';
import '../../../../core/widgets/back_to_top.dart';

/// Where the home's links lead in the shell: the pages of the top strip.
class SiteHomeLinks {
  const SiteHomeLinks({
    required this.products,
    required this.services,
    required this.companies,
    required this.orders,
    this.category,
  });

  final VoidCallback products;
  final VoidCallback services;
  final VoidCallback companies;
  final VoidCallback orders;

  /// Opens the products page on a category (else its own screen opens).
  final ValueChanged<String>? category;
}

/// The numbers of the home's band (`siteStats`): active companies, products
/// and services offered, the cities the companies are in and the reviews
/// customers wrote. A zero is left out.
List<(String, int)> siteHomeStats(
  BuildContext context, {
  required List<Company> companies,
  required int items,
  required Map<String, RatingStats> ratings,
}) {
  final l10n = context.l10n;
  var reviews = 0;
  for (final entry in ratings.entries) {
    if (entry.key.startsWith('company_')) reviews += entry.value.count;
  }
  final cities = {
    for (final c in companies)
      if ((c.city ?? '').trim().isNotEmpty) c.city!.trim(),
  }.length;
  return [
    (l10n.siteStatCompanies, companies.length),
    (l10n.siteStatItems, items),
    (l10n.siteStatCities, cities),
    (l10n.siteStatReviews, reviews),
  ].where((s) => s.$2 > 0).toList();
}

/// The services the home puts forward (`featuredServices`): a running
/// discount first (the biggest first), then the ones most companies offer,
/// then by name.
List<ServiceListing> siteFeaturedServices(
  List<ServiceListing> listings, [
  int limit = 4,
]) {
  final list = listings.where((l) => l.offers.isNotEmpty).toList()
    ..sort(
      (a, b) => b.bestDiscount.compareTo(a.bestDiscount) != 0
          ? b.bestDiscount.compareTo(a.bestDiscount)
          : b.offers.length.compareTo(a.offers.length) != 0
          ? b.offers.length.compareTo(a.offers.length)
          : a.service.name.compareTo(b.service.name),
    );
  return list.take(limit).toList();
}

/// sictm.net's home on a phone, section for section: the search hero, the
/// moving offers, the market's numbers, the main categories, «اطلب فنيًا»,
/// the featured offers, the newest products, the featured services, the top
/// companies, and the site's footer.
class SiteHomePage extends ConsumerWidget {
  const SiteHomePage({super.key, required this.links});

  final SiteHomeLinks links;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final products = ref.watch(marketplaceProductsProvider);
    final loading =
        ref.watch(firestoreProductsStreamProvider).isLoading &&
        products.isEmpty;
    final companies = ref.watch(marketplaceCompaniesProvider);
    final services =
        ref.watch(marketplaceServicesProvider).asData?.value ??
        const <CatalogService>[];
    final links_ =
        ref.watch(allActiveCompanyServicesProvider).asData?.value ??
        const <CompanyService>[];
    final listings = buildServiceListings(
      services: services,
      links: links_,
      companies: companies,
    ).where((l) => l.offers.isNotEmpty).toList();
    final ratings =
        ref.watch(ratingsProvider).asData?.value ??
        const <String, RatingStats>{};
    final tree = ref.watch(categoryTreeProvider);
    final counts = ref.watch(categoryCountsProvider);
    final roots = tree.activeChildrenOf(null);

    final heroOffers = runningOffers([
      for (final p in products) ProductOfferItem(p),
      ...ref.watch(marketplaceServiceOffersProvider),
    ]).take(5).toList();
    final offers = products.where((p) => p.hasActiveOffer).take(4).toList();
    final shown = {for (final p in offers) p.id};
    final fresh = [...products.where((p) => !shown.contains(p.id))]
      ..sort((a, b) {
        final x = a.createdAt;
        final y = b.createdAt;
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return y.compareTo(x);
      });
    final newest = fresh.take(8).toList();
    final featured = siteFeaturedServices(listings);
    double average(Company c) {
      final s = ratings[RatingStats.keyFor('company', c.id)];
      return s != null && s.count > 0 ? s.sum / s.count : c.rating;
    }

    int reviewCount(Company c) =>
        ratings[RatingStats.keyFor('company', c.id)]?.count ?? c.reviewCount;
    final topCompanies = [...companies]
      ..sort((a, b) {
        final byAverage = average(b).compareTo(average(a));
        return byAverage != 0
            ? byAverage
            : reviewCount(b).compareTo(reviewCount(a));
      });
    final itemCounts = <String, int>{};
    for (final p in products) {
      final id = p.companyId ?? '';
      itemCounts[id] = (itemCounts[id] ?? 0) + 1;
    }
    for (final l in listings) {
      for (final o in l.offers) {
        itemCounts[o.companyId] = (itemCounts[o.companyId] ?? 0) + 1;
      }
    }
    final stats = loading
        ? const <(String, int)>[]
        : siteHomeStats(
            context,
            companies: companies,
            items: products.length + listings.length,
            ratings: ratings,
          );

    const gap = SizedBox(height: 32);
    Widget pad(Widget child) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: child,
    );

    return BackToTop(child: ListView(
      key: const ValueKey('site-home'),
      primary: false,
      padding: const EdgeInsets.only(top: 20),
      children: [
        pad(const _SearchHero()),
        if (heroOffers.isNotEmpty) ...[
          gap,
          pad(SiteHeroOffers(offers: heroOffers)),
        ],
        if (stats.isNotEmpty) ...[gap, pad(_StatBand(stats: stats))],
        if (loading || roots.isNotEmpty) ...[
          gap,
          pad(
            SiteSectionTitle(
              title: l10n.siteMainCategories,
              onViewAll: links.products,
            ),
          ),
          pad(
            loading
                ? const AppSkeletonList(count: 1)
                : SiteGrid(
                    columns: 3,
                    spacing: 10,
                    children: [
                      for (final c in roots)
                        SiteCategoryCard(
                          category: c,
                          count: counts?[c.id]?.total ?? 0,
                          onOpen: links.category,
                        ),
                    ],
                  ),
          ),
        ],
        gap,
        pad(_Promo(onTap: links.services)),
        if (offers.isNotEmpty) ...[
          gap,
          pad(
            SiteSectionTitle(
              title: l10n.siteFeaturedOffers,
              onViewAll: links.products,
            ),
          ),
          pad(_Cards(products: offers)),
        ],
        if (loading || newest.isNotEmpty || offers.isEmpty) ...[
          gap,
          pad(
            SiteSectionTitle(
              title: l10n.siteNewestProducts,
              onViewAll: links.products,
            ),
          ),
          pad(
            loading
                ? const AppSkeletonList(count: 2)
                : newest.isEmpty
                ? AppEmptyState(
                    icon: Icons.inventory_2_outlined,
                    message: l10n.siteNoProducts,
                  )
                : _Cards(products: newest),
          ),
        ],
        if (featured.isNotEmpty) ...[
          gap,
          pad(
            SiteSectionTitle(
              title: l10n.siteFeaturedServices,
              onViewAll: links.services,
            ),
          ),
          pad(
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < featured.length; i++) ...[
                  if (i > 0) const SizedBox(height: 12),
                  SiteServiceCard(listing: featured[i]),
                ],
              ],
            ),
          ),
        ],
        gap,
        pad(
          SiteSectionTitle(
            title: l10n.siteTopCompanies,
            onViewAll: links.companies,
          ),
        ),
        pad(
          topCompanies.isEmpty
              ? AppEmptyState(
                  icon: Icons.apartment_rounded,
                  message: l10n.siteNoCompanies,
                )
              : Column(
                  children: [
                    for (var i = 0; i < topCompanies.length && i < 6; i++) ...[
                      if (i > 0) const SizedBox(height: 16),
                      SiteCompanyCard(
                        company: topCompanies[i],
                        itemCount: itemCounts[topCompanies[i].id] ?? 0,
                      ),
                    ],
                  ],
                ),
        ),
        gap,
        SiteFooter(links: links),
      ],
    ));
  }
}

class _Cards extends StatelessWidget {
  const _Cards({required this.products});

  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < products.length; i++) ...[
          if (i > 0) const SizedBox(height: 16),
          SiteProductCard(product: products[i]),
        ],
      ],
    );
  }
}

/// The navy-to-teal hero with the big title, the search box and the quick
/// words (`.home-hero`).
class _SearchHero extends StatefulWidget {
  const _SearchHero();

  @override
  State<_SearchHero> createState() => _SearchHeroState();
}

class _SearchHeroState extends State<_SearchHero> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _search(String text) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CustomerSearchScreen(initialQuery: text.trim()),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final quick = [
      'Cisco',
      l10n.siteQuickRouter,
      l10n.siteQuickCameras,
      'UPS',
      l10n.siteQuickServer,
    ];
    return ClipRRect(
      key: const ValueKey('site-hero'),
      borderRadius: BorderRadius.circular(24),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [colors.heroStart, colors.heroMid, colors.heroEnd],
            stops: const [0, 0.62, 1],
          ),
        ),
        child: Stack(
          children: [
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0.8, -1.3),
                    radius: 1.2,
                    colors: [Color(0x6634D3C0), Color(0x0034D3C0)],
                  ),
                ),
              ),
            ),
            const Positioned.fill(child: SiteDots()),
            Padding(
              padding: const EdgeInsets.fromLTRB(48, 56, 48, 48),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      '${l10n.siteHeroTitleLine1}\n${l10n.siteHeroTitleLine2}',
                      style: AppTextStyles.h1.copyWith(
                        color: Colors.white,
                        fontSize: 26,
                        height: 1.35,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    l10n.siteHeroBody,
                    style: AppTextStyles.body.copyWith(
                      color: Colors.white.withValues(alpha: 0.92),
                      fontSize: 16,
                      height: 1.7,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    height: 54,
                    padding: const EdgeInsetsDirectional.fromSTEB(14, 0, 5, 0),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x33052B57),
                          blurRadius: 30,
                          offset: Offset(0, 12),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _query,
                            textInputAction: TextInputAction.search,
                            onSubmitted: _search,
                            style: AppTextStyles.body.copyWith(
                              color: const Color(0xFF12263F),
                              fontSize: 15,
                            ),
                            decoration: InputDecoration(
                              hintText: l10n.searchHint,
                              hintStyle: AppTextStyles.body.copyWith(
                                color: const Color(0xFF5D6F86),
                                fontSize: 15,
                              ),
                              filled: false,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        SizedBox(
                          height: 44,
                          child: FilledButton(
                            onPressed: () => _search(_query.text),
                            style: FilledButton.styleFrom(
                              minimumSize: const Size(0, 44),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 18,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                              backgroundColor: colors.action,
                              textStyle: AppTextStyles.buttonMedium.copyWith(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            child: Text(l10n.commonSearch),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final word in quick)
                        Material(
                          color: Colors.white.withValues(alpha: 0.12),
                          shape: StadiumBorder(
                            side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.25),
                            ),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: InkWell(
                            onTap: () => _search(word),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 6,
                              ),
                              child: Text(
                                word,
                                style: AppTextStyles.bodyStrong.copyWith(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The market's numbers, two in a row on a phone (`.stat-band`).
class _StatBand extends StatelessWidget {
  const _StatBand({required this.stats});

  final List<(String, int)> stats;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return LayoutBuilder(
      builder: (context, constraints) {
        final perRow = (constraints.maxWidth / 162).floor().clamp(1, 4);
        final width = (constraints.maxWidth - (perRow - 1) * 12) / perRow;
        return Wrap(
          key: const ValueKey('site-stats'),
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final (label, value) in stats)
              SizedBox(
                width: width,
                child: SiteCard(
                  radius: 16,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 18,
                  ),
                  child: Column(
                    children: [
                      Text(
                        '$value',
                        style: AppTextStyles.h1.copyWith(
                          fontSize: 30,
                          height: 1.2,
                          fontWeight: FontWeight.w800,
                          color: colors.textBrand,
                        ),
                      ),
                      Text(
                        label,
                        textAlign: TextAlign.center,
                        style: AppTextStyles.bodyStrong.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// «خدمات / اطلب فنيًا لخدمتك» (`.promo`).
class _Promo extends StatelessWidget {
  const _Promo({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = context.l10n;
    return Material(
      key: const ValueKey('site-promo'),
      color: colors.brandPrimarySubtle,
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 18),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  Icons.build_outlined,
                  size: 26,
                  color: colors.textBrand,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.sitePromoKicker,
                      style: AppTextStyles.captionStrong.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: colors.textBrand,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      l10n.sitePromoTitle,
                      style: AppTextStyles.h2.copyWith(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: colors.primary,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.arrow_forward_rounded,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The site's footer (`SiteFooter`): the name and what it is, then the store,
/// account and support links.
class SiteFooter extends ConsumerWidget {
  const SiteFooter({super.key, required this.links});

  final SiteHomeLinks links;

  Future<void> _open(String url) async {
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final line = Colors.white.withValues(alpha: 0.14);
    void push(Widget screen) =>
        Navigator.of(context)
            .push(MaterialPageRoute<void>(builder: (_) => screen));

    Widget column(String title, List<(String, VoidCallback)> items) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.only(bottom: 10),
            margin: const EdgeInsets.only(bottom: 6),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: line)),
            ),
            child: Text(
              title,
              style: AppTextStyles.bodyStrong.copyWith(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          for (final (label, onTap) in items)
            InkWell(
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Text(
                  label,
                  style: AppTextStyles.bodyStrong.copyWith(
                    color: const Color(0xFFEAF0FA).withValues(alpha: 0.82),
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      );
    }

    final store = column(l10n.siteFooterStore, [
      (l10n.navHome, () {}),
      (l10n.navProducts, links.products),
      (l10n.navServices, links.services),
      (l10n.navCompanies, links.companies),
    ]);
    final account = column(l10n.navMyAccount, [
      (
        l10n.navMyOrders,
        () {
          if (requireAccount(context, ref)) {
            links.orders();
          }
        },
      ),
      (
        l10n.favoritesTitle,
        () {
          if (requireAccount(context, ref)) {
            push(const FavoritesScreen());
          }
        },
      ),
      (l10n.siteRequestTechnician, links.services),
      (l10n.settingsTitle, () => push(const SettingsScreen())),
    ]);
    final support = column(l10n.siteFooterSupport, [
      (l10n.siteFooterTerms, () => push(const SiteTermsPage())),
      (l10n.siteFooterCompanyPortal, () => _open('https://company.sictm.net')),
      (l10n.siteFooterTechPortal, () => _open('https://tech.sictm.net')),
    ]);

    return Container(
      key: const ValueKey('site-footer'),
      color: const Color(0xFF052B57),
      padding: const EdgeInsets.fromLTRB(20, 32, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 56,
                height: 56,
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Image.asset('assets/images/app_mark.png'),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  l10n.siteFooterName,
                  style: AppTextStyles.h2.copyWith(
                    color: const Color(0xFFEAF0FA),
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            l10n.siteFooterAbout,
            style: AppTextStyles.body.copyWith(
              color: const Color(0xFFEAF0FA).withValues(alpha: 0.72),
              fontSize: 14,
              height: 1.9,
            ),
          ),
          const SizedBox(height: 40),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: store),
              const SizedBox(width: 32),
              Expanded(child: account),
            ],
          ),
          const SizedBox(height: 28),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: support),
              const SizedBox(width: 32),
              const Expanded(child: SizedBox.shrink()),
            ],
          ),
          Container(
            margin: const EdgeInsets.only(top: 40),
            padding: const EdgeInsets.only(top: 18),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: line)),
            ),
            width: double.infinity,
            child: Text(
              '© ${DateTime.now().year} ${l10n.siteFooterName}',
              style: AppTextStyles.caption.copyWith(
                color: const Color(0xFFEAF0FA).withValues(alpha: 0.62),
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
