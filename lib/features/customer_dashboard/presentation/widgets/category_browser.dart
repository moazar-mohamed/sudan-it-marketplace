import 'package:flutter/material.dart';

import '../../../categories/domain/category_tree.dart';
import 'category_browse.dart';
import 'category_grid.dart';
import 'category_grid_style.dart';

/// The customer's way into the category tree: tiles for the top-level
/// categories, each with what it holds. Choosing one calls [onOpen]; the
/// category then has a screen of its own with its sub-categories and filters.
///
/// Every category customers can see (active, under active parents) is offered
/// the moment Platform Admin adds it, except that, once the counts are known,
/// one with nothing in it is left out until something is filed in it.
class CategoryBrowser extends StatelessWidget {
  const CategoryBrowser({
    super.key,
    required this.tree,
    required this.onOpen,
    this.counts,
    this.title,
    this.style = CategoryGridStyle.standard,
    this.horizontalPadding = 0,
  });

  final CategoryTree tree;
  final ValueChanged<String> onOpen;

  /// What each category holds, shown on every tile; null while loading. A
  /// category with nothing in it yet is offered too, with a count of 0.
  final Map<String, CategoryCount>? counts;

  /// The tiles' section title, and how they are drawn ([CategoryGridStyle.homeRow]
  /// on the home screen). [horizontalPadding] is the side space of everything
  /// here, so the sideways row can scroll up to the screen edge.
  final String? title;
  final CategoryGridStyle style;
  final double horizontalPadding;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      ...tree.activeChildrenOf(null),
    ];
    if (tiles.isEmpty) return const SizedBox.shrink();
    return CategoryGrid(
      categories: tiles,
      selectedId: null,
      counts: counts,
      onSelected: (id) {
        if (id != null) onOpen(id);
      },
      style: style,
      title: title,
      horizontalPadding: horizontalPadding,
    );
  }
}
