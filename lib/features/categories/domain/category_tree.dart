import '../../../core/utils/arabic_text.dart';
import 'entities/category.dart';

/// The category tree shared by products and services, built from the flat list
/// of categories. Any depth works: every walk is iterative and guards against a
/// cycle in bad data, so nothing here can hang or overflow.
class CategoryTree {
  factory CategoryTree(Iterable<Category> categories) {
    final byId = <String, Category>{
      for (final category in categories) category.id: category,
    };
    final children = <String?, List<Category>>{};
    for (final category in byId.values) {
      // A category whose parent is missing is treated as top-level.
      final parent = category.parentId;
      final key = parent != null && byId.containsKey(parent) ? parent : null;
      children.putIfAbsent(key, () => []).add(category);
    }
    for (final list in children.values) {
      list.sort(compareCategories);
    }
    return CategoryTree._(byId, children);
  }

  const CategoryTree._(this._byId, this._children);

  final Map<String, Category> _byId;
  final Map<String?, List<Category>> _children;

  Iterable<Category> get all => _byId.values;
  bool get isEmpty => _byId.isEmpty;

  Category? byId(String? id) => id == null ? null : _byId[id];
  bool contains(String? id) => id != null && _byId.containsKey(id);

  /// The categories directly under [parentId] (null = top level), in the order
  /// Platform Admin set.
  List<Category> childrenOf(String? parentId) =>
      _children[parentId] ?? const [];

  bool hasChildren(String id) => (_children[id] ?? const []).isNotEmpty;

  /// The categories from the top of the tree down to [id], inclusive.
  List<Category> pathOf(String id) {
    final path = <Category>[];
    final seen = <String>{};
    var current = _byId[id];
    while (current != null && seen.add(current.id)) {
      path.insert(0, current);
      final parent = current.parentId;
      current = parent == null ? null : _byId[parent];
    }
    return path;
  }

  /// "Networking › Routers › Wi-Fi 6" in [languageCode] ('ar' or 'en').
  String pathLabel(
    String id,
    String languageCode, {
    String separator = ' › ',
  }) => pathOf(id).map((c) => c.nameFor(languageCode)).join(separator);

  /// [id] and every category below it, at any depth.
  Set<String> subtreeIds(String id) {
    final result = <String>{};
    if (!_byId.containsKey(id)) return result;
    final queue = <String>[id];
    while (queue.isNotEmpty) {
      final next = queue.removeLast();
      if (!result.add(next)) continue;
      for (final child in childrenOf(next)) {
        queue.add(child.id);
      }
    }
    return result;
  }

  /// Active itself and under active ancestors only: what customers and
  /// companies are shown. A category awaiting deletion is never shown.
  bool isEffectivelyActive(String id) {
    final path = pathOf(id);
    return path.isNotEmpty &&
        path.every((c) => c.isActive && !c.deletionPending);
  }

  /// [childrenOf], keeping only the ones that are effectively active.
  List<Category> activeChildrenOf(String? parentId) => [
    for (final child in childrenOf(parentId))
      if (isEffectivelyActive(child.id)) child,
  ];

  /// Effectively active categories whose Arabic or English name contains
  /// [query] (forgiving spelling), each with its position in the tree.
  List<Category> search(String query) {
    final needle = normalizeSearchText(query);
    if (needle.isEmpty) return const [];
    final matches = [
      for (final category in _byId.values)
        if (normalizeSearchText(category.searchText).contains(needle) &&
            isEffectivelyActive(category.id))
          category,
    ];
    matches.sort((a, b) => _sortKey(a).compareTo(_sortKey(b)));
    return matches;
  }

  String _sortKey(Category category) =>
      pathOf(category.id).map((c) => c.name.toLowerCase()).join('/');
}
