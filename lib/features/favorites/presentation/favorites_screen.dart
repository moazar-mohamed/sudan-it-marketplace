import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../company_services/presentation/company_service_providers.dart';
import '../../customer_dashboard/presentation/site/site_cards.dart';
import '../../customer_dashboard/presentation/site/site_detail_parts.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../../customer_dashboard/presentation/site/site_orders.dart';
import '../../customer_dashboard/presentation/widgets/home_service_view.dart';
import '../../products/presentation/products_providers.dart';
import '../../services/domain/entities/catalog_service.dart';
import '../../services/presentation/service_providers.dart';
import '../domain/favorite.dart';
import 'favorite_button.dart';
import 'favorites_providers.dart';

/// «المفضلة» as on sictm.net (`pages/FavoritesPage.tsx`): the saved products
/// as product cards, then the saved services, then what is no longer
/// offered (marked; something removed from the catalogue is not listed).
class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key, this.onBrowse});

  /// «تصفّح المنتجات والخدمات» while nothing is saved.
  final VoidCallback? onBrowse;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final favorites = ref.watch(favoritesProvider);
    final productsLoading = ref
        .watch(firestoreProductsStreamProvider)
        .isLoading;
    final services = ref.watch(marketplaceServicesProvider);

    Widget page(List<Widget> blocks) => ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
      children: [
        SitePageTitle(l10n.favoritesTitle),
        for (final block in blocks) ...[const SizedBox(height: 16), block],
      ],
    );

    return Scaffold(
      appBar: AppBar(),
      body: favorites.when(
        loading: () => const AppLoadingState(),
        error: (_, _) => AppErrorState(
          message: l10n.favoritesLoadFailed,
          onRetry: () => ref.invalidate(favoritesProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return page([
              SiteEmptyState(
                title: l10n.favoritesEmptyTitle,
                message: l10n.favoritesEmptyMessage,
                actionLabel: l10n.siteBrowseAll,
                onAction: onBrowse ?? () => siteOpenShop(context, ref),
              ),
            ]);
          }
          if (productsLoading || services.isLoading) {
            return const AppLoadingState();
          }
          final products = ref.watch(marketplaceProductsProvider);
          final serviceList =
              services.asData?.value ?? const <CatalogService>[];
          final listings = buildServiceListings(
            services: serviceList,
            links:
                ref.watch(allActiveCompanyServicesProvider).asData?.value ??
                const [],
            companies: ref.watch(marketplaceCompaniesProvider),
          );
          final savedProducts = [
            for (final f in items)
              if (f.kind == FavoriteKind.product)
                ?products.where((p) => p.id == f.targetId).firstOrNull,
          ];
          final savedServices = [
            for (final f in items)
              if (f.kind == FavoriteKind.service)
                ?listings.where((l) => l.service.id == f.targetId).firstOrNull,
          ];
          final shownIds = {
            for (final p in savedProducts) p.id,
            for (final l in savedServices) l.service.id,
          };
          final unavailable = [
            for (final f in items)
              if (!shownIds.contains(f.targetId)) f,
          ];
          return page([
            for (final p in savedProducts) SiteProductCard(product: p),
            for (final l in savedServices) SiteServiceCard(listing: l),
            for (final f in unavailable) _Unavailable(favorite: f),
          ]);
        },
      ),
    );
  }
}

/// A saved item no longer offered (`.scard.fav-off`): its name, «غير متاح
/// حاليًا» and the heart to remove it.
class _Unavailable extends ConsumerWidget {
  const _Unavailable({required this.favorite});

  final Favorite favorite;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final exists = ref.watch(
      favoriteTargetExistsProvider((
        kind: favorite.kind,
        targetId: favorite.targetId,
      )),
    );
    if (exists.value == false) return const SizedBox.shrink();
    return Opacity(
      opacity: 0.75,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: colors.borderDefault),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    favorite.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodyStrong.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    context.l10n.favoriteUnavailable,
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 13,
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            FavoriteButton(
              kind: favorite.kind,
              targetId: favorite.targetId,
              name: favorite.name,
            ),
          ],
        ),
      ),
    );
  }
}
