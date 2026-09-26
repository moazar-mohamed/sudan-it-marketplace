import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../categories/domain/category_tree.dart';
import '../../../categories/domain/entities/category.dart';
import 'category_grid.dart';

/// The customer's way into a category tree: tiles for the categories at the
/// current level, a breadcrumb back up, and the whole subtree of the chosen
/// category as the filter. Works at any depth.
///
/// Every category customers can see (active, under active parents) is offered
/// the moment Platform Admin adds it, even before anything is filed in it.
class CategoryBrowser extends StatelessWidget {
  const CategoryBrowser({
    super.key,
    required this.tree,
    required this.currentId,
    required this.onChanged,
  });

  final CategoryTree tree;

  /// The category being browsed (its whole subtree is the filter); null = all.
  final String? currentId;
  final ValueChanged<String?> onChanged;

  /// The category to filter by: [currentId] if it is still shown, else none.
  static String? validCurrent(CategoryTree tree, String? id) =>
      id != null && tree.isEffectivelyActive(id) ? id : null;

  @override
  Widget build(BuildContext context) {
    final tiles = tree.activeChildrenOf(currentId);
    final current = currentId;
    if (tiles.isEmpty && current == null) return const SizedBox.shrink();
    final language = Localizations.localeOf(context).languageCode;
    final path = current == null ? const <Category>[] : tree.pathOf(current);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (current != null)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.s8),
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _Crumb(
                  key: const ValueKey('browse-crumb-root'),
                  label: context.l10n.homeFilterAllCategories,
                  onTap: () => onChanged(null),
                ),
                for (final category in path) ...[
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: AppSize.iconSm,
                    color: AppColors.textSecondary,
                  ),
                  _Crumb(
                    key: ValueKey('browse-crumb-${category.id}'),
                    label: category.nameFor(language),
                    onTap: category.id == current
                        ? null
                        : () => onChanged(category.id),
                  ),
                ],
              ],
            ),
          ),
        if (tiles.isNotEmpty)
          CategoryGrid(
            categories: tiles,
            selectedId: null,
            // Tapping a tile goes into it: its subtree becomes the filter.
            onSelected: onChanged,
          ),
      ],
    );
  }
}

class _Crumb extends StatelessWidget {
  const _Crumb({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s8),
        minimumSize: const Size(0, 36),
      ),
      child: Text(
        label,
        style: AppTextStyles.labelMedium.copyWith(
          color: onTap == null ? AppColors.textPrimary : AppColors.textBrand,
          fontWeight: onTap == null ? FontWeight.w700 : FontWeight.w600,
        ),
      ),
    );
  }
}
