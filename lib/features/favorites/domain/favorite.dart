enum FavoriteKind {
  product,
  service;

  static FavoriteKind? fromValue(Object? value) {
    for (final kind in values) {
      if (kind.name == value) return kind;
    }
    return null;
  }
}

/// A product or catalogue service a customer saved. Its name is kept so an
/// entry can still be read after the item stops being offered.
class Favorite {
  const Favorite({
    required this.kind,
    required this.targetId,
    required this.name,
    required this.createdAt,
  });

  /// The document id, fixed per item so one can only be saved once.
  static String keyFor(FavoriteKind kind, String targetId) =>
      '${kind.name}_$targetId';

  final FavoriteKind kind;
  final String targetId;
  final String name;
  final DateTime createdAt;

  String get key => keyFor(kind, targetId);
}
