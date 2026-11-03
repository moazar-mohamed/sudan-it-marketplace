import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/domain/entities/user_role.dart';
import '../../customer_dashboard/presentation/profile_controller.dart';
import '../data/favorites_store.dart';
import '../domain/favorite.dart';

final favoritesStoreProvider = Provider<FavoritesStore>((ref) => FavoritesStore());

/// The signed-in customer's id; null for anyone else, who has no favorites.
final favoritesOwnerProvider = Provider<String?>((ref) {
  final profile = ref.watch(profileControllerProvider).value;
  return profile?.role == UserRole.customer ? profile?.id : null;
});

final favoritesProvider = StreamProvider<List<Favorite>>((ref) {
  final uid = ref.watch(favoritesOwnerProvider);
  if (uid == null) return Stream.value(const <Favorite>[]);
  return ref.watch(favoritesStoreProvider).watch(uid);
});

/// The saved items, for marking hearts.
final favoriteKeysProvider = Provider<Set<String>>((ref) {
  final favorites = ref.watch(favoritesProvider).value ?? const <Favorite>[];
  return {for (final favorite in favorites) favorite.key};
});

final favoriteTargetExistsProvider = FutureProvider.autoDispose
    .family<bool, ({FavoriteKind kind, String targetId})>((ref, target) {
  return ref
      .watch(favoritesStoreProvider)
      .targetExists(target.kind, target.targetId);
});
