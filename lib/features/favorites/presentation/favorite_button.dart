import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_widgets.dart';
import '../domain/favorite.dart';
import 'favorites_providers.dart';

/// The heart that saves a product or service. It shows only for a customer.
class FavoriteButton extends ConsumerStatefulWidget {
  const FavoriteButton({
    super.key,
    required this.kind,
    required this.targetId,
    required this.name,
    this.onImage = false,
  });

  final FavoriteKind kind;
  final String targetId;
  final String name;

  /// Sits on a picture: drawn on a small disc so it stays readable.
  final bool onImage;

  @override
  ConsumerState<FavoriteButton> createState() => _FavoriteButtonState();
}

class _FavoriteButtonState extends ConsumerState<FavoriteButton> {
  bool _busy = false;

  Future<void> _toggle(String uid, bool saved) async {
    if (_busy) return;
    setState(() => _busy = true);
    final store = ref.read(favoritesStoreProvider);
    try {
      if (saved) {
        await store.remove(uid, widget.kind, widget.targetId);
      } else {
        await store.add(uid, widget.kind, widget.targetId, widget.name);
      }
    } catch (_) {
      if (mounted) {
        showAppSnackBar(
          context,
          context.l10n.favoriteSaveFailed,
          tone: AppTone.error,
        );
      }
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(favoritesOwnerProvider);
    if (uid == null) return const SizedBox.shrink();
    final saved = ref
        .watch(favoriteKeysProvider)
        .contains(Favorite.keyFor(widget.kind, widget.targetId));
    final colors = context.colors;
    final button = IconButton(
      key: ValueKey('favorite-${widget.kind.name}-${widget.targetId}'),
      tooltip: saved ? context.l10n.favoriteRemove : context.l10n.favoriteAdd,
      visualDensity: VisualDensity.compact,
      icon: Icon(
        saved ? Icons.favorite : Icons.favorite_border,
        color: saved ? colors.error : colors.textSecondary,
      ),
      onPressed: () => _toggle(uid, saved),
    );
    if (!widget.onImage) return button;
    return DecoratedBox(
      decoration: BoxDecoration(color: colors.surface, shape: BoxShape.circle),
      child: button,
    );
  }
}
