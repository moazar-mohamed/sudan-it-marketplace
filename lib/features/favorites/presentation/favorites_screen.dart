import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../products/domain/entities/product.dart';
import '../../products/presentation/products_providers.dart';
import '../../products/presentation/widgets/product_card.dart';
import '../../services/domain/entities/catalog_service.dart';
import '../../services/presentation/service_providers.dart';
import '../../services/presentation/widgets/service_card.dart';
import '../domain/favorite.dart';
import 'favorite_button.dart';
import 'favorites_providers.dart';

/// What the customer saved, newest first. An item no longer offered stays,
/// marked unavailable; one removed from the catalogue is no longer listed.
class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final favorites = ref.watch(favoritesProvider);
    final productsLoading = ref.watch(firestoreProductsStreamProvider).isLoading;
    final services = ref.watch(marketplaceServicesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.favoritesTitle)),
      body: favorites.when(
        loading: () => const AppLoadingState(),
        error: (_, _) => AppErrorState(
          message: l10n.favoritesLoadFailed,
          onRetry: () => ref.invalidate(favoritesProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return AppEmptyState(
              icon: Icons.favorite_border,
              title: l10n.favoritesEmptyTitle,
              message: l10n.favoritesEmptyMessage,
              expandVertically: true,
            );
          }
          if (productsLoading || services.isLoading) {
            return const AppLoadingState();
          }
          final products = ref.watch(marketplaceProductsProvider);
          final serviceList = services.asData?.value ?? const <CatalogService>[];
          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.s16),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s12),
            itemBuilder: (context, index) {
              final favorite = items[index];
              if (favorite.kind == FavoriteKind.product) {
                final Product? product = products
                    .where((p) => p.id == favorite.targetId)
                    .firstOrNull;
                if (product != null) return ProductCard(product: product);
              } else {
                final CatalogService? service = serviceList
                    .where((s) => s.id == favorite.targetId)
                    .firstOrNull;
                if (service != null) return ServiceCard(service: service);
              }
              return _Unavailable(favorite: favorite);
            },
          );
        },
      ),
    );
  }
}

class _Unavailable extends ConsumerWidget {
  const _Unavailable({required this.favorite});

  final Favorite favorite;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final exists = ref.watch(
      favoriteTargetExistsProvider(
        (kind: favorite.kind, targetId: favorite.targetId),
      ),
    );
    if (exists.value == false) return const SizedBox.shrink();
    return AppListCard(
      showChevron: false,
      leading: const AppIconTile(icon: Icons.block, size: 52),
      trailing: FavoriteButton(
        kind: favorite.kind,
        targetId: favorite.targetId,
        name: favorite.name,
      ),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            favorite.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodyStrong,
          ),
          Text(
            context.l10n.favoriteUnavailable,
            style: AppTextStyles.caption.copyWith(
              color: context.colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
