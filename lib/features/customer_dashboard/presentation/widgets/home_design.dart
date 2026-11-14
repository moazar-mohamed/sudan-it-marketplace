import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../categories/domain/entities/category.dart';
import 'category_grid.dart';
import 'category_grid_style.dart';

/// Colours and small shared pieces of the customer home design that no
/// design token covers. Everything else comes from [AppColorTokens].
class HomePalette {
  HomePalette._();

  /// The hero offer card.
  static const Color heroNavy = Color(0xFF0B2A57);

  /// The "top rated" badge on a company.
  static const Color gold = Color(0xFFF59E0B);
}

/// The colour a category (and what is filed under it) is drawn in, and the
/// soft tint behind it: the same colours the category cards already use, so a
/// category looks the same everywhere on the home.
class CategoryLook {
  const CategoryLook({required this.icon, required this.accent});

  final IconData icon;
  final Color accent;

  /// A category, or the generic look when [category] is unknown.
  factory CategoryLook.of(Category? category, {String fallbackId = ''}) {
    if (category == null) {
      return CategoryLook(
        icon: Icons.category_outlined,
        accent: CategoryGridStyle.standard.colorFor(
          Icons.category_outlined,
          fallbackId,
        ),
      );
    }
    final icon = categoryIconFor(category);
    return CategoryLook(
      icon: icon,
      accent: CategoryGridStyle.standard.colorOfCategory(category, icon),
    );
  }

  /// The soft background behind the icon, in the current appearance.
  Color tint(BuildContext context) => CategoryGridStyle.standard.backgroundFor(
    accent,
    context.colors.surface,
    Theme.of(context).brightness,
  );
}

/// The colour of something with no category of its own (a company's letter),
/// the same for the same [seed] on every device.
CategoryLook lookForSeed(String seed) => CategoryLook(
  icon: Icons.business_outlined,
  accent: CategoryGridStyle.standard.colorFor(Icons.business_outlined, seed),
);

/// A section title with an optional "View all" link at the other end.
class HomeSectionHeader extends StatelessWidget {
  const HomeSectionHeader({
    super.key,
    required this.title,
    this.leading,
    this.actionLabel,
    this.onAction,
    this.actionKey,
  });

  final String title;

  /// An icon before the title (the flame of the offers).
  final Widget? leading;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Key? actionKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      children: [
        if (leading != null) ...[
          leading!,
          const SizedBox(width: AppSpacing.s4),
        ],
        Expanded(
          child: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.h2,
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton.icon(
            key: actionKey,
            onPressed: onAction,
            icon: const Icon(Icons.chevron_right_rounded, size: AppSize.iconMd),
            iconAlignment: IconAlignment.end,
            label: Text(actionLabel!),
            style: TextButton.styleFrom(
              foregroundColor: colors.textBrand,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s8),
              minimumSize: const Size(0, 36),
              textStyle: AppTextStyles.buttonSmall,
            ),
          ),
      ],
    );
  }
}
