import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../search/presentation/customer_search_screen.dart';

/// The band under the app bar that holds the search box and the
/// Products | Services | Companies switch. It continues the app bar's own
/// colour (brand blue; the raised surface in dark mode), so the two read as
/// one header. The app bar itself is not part of it.
class HomeHeaderBlock extends StatelessWidget {
  const HomeHeaderBlock({
    super.key,
    required this.tabLabels,
    required this.selectedIndex,
    required this.onTabChanged,
  });

  final List<String> tabLabels;
  final int selectedIndex;
  final ValueChanged<int> onTabChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);
    return ColoredBox(
      color: isDark ? colors.bgSurface : colors.primary,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          margin,
          AppSpacing.s4,
          margin,
          AppSpacing.s16,
        ),
        child: Column(
          children: [
            const HomeSearchLauncher(),
            const SizedBox(height: AppSpacing.s12),
            HomeSegmentedTabs(
              labels: tabLabels,
              selectedIndex: selectedIndex,
              onChanged: onTabChanged,
            ),
          ],
        ),
      ),
    );
  }
}

/// Looks like a search box; opens the full search, which covers products,
/// services and companies at once.
class HomeSearchLauncher extends StatelessWidget {
  const HomeSearchLauncher({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      button: true,
      label: context.l10n.searchHint,
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: AppRadius.lgAll,
          boxShadow: isDark
              ? null
              : const [
                  BoxShadow(
                    color: Color(0x24000000),
                    blurRadius: 10,
                    offset: Offset(0, 3),
                  ),
                ],
        ),
        child: Material(
          key: const ValueKey('home-search-launcher'),
          color: isDark ? colors.bgSubtle : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const CustomerSearchScreen(),
              ),
            ),
            child: SizedBox(
              height: 52,
              child: Row(
                children: [
                  const SizedBox(width: AppSpacing.s16),
                  Icon(Icons.search_rounded, color: colors.iconDefault),
                  const SizedBox(width: AppSpacing.s12),
                  Expanded(
                    child: Text(
                      context.l10n.searchHint,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body.copyWith(
                        color: colors.textTertiary,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.s16),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The pill switch: a darker track with the chosen label on a white pill.
/// The order follows the reading direction.
class HomeSegmentedTabs extends StatelessWidget {
  const HomeSegmentedTabs({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onChanged,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final track = isDark
        ? colors.bgSubtle
        : Color.alphaBlend(const Color(0x38000000), colors.primary);
    final pill = isDark ? colors.bgMuted : Colors.white;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s4),
      decoration: BoxDecoration(
        color: track,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: Semantics(
                button: true,
                selected: i == selectedIndex,
                excludeSemantics: true,
                label: labels[i],
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onChanged(i),
                  child: AnimatedContainer(
                    duration: AppMotion.state,
                    height: 40,
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.s4,
                    ),
                    decoration: BoxDecoration(
                      color: i == selectedIndex ? pill : Colors.transparent,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Text(
                      labels[i],
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.labelLarge.copyWith(
                        color: i == selectedIndex
                            ? (isDark ? colors.textBrand : colors.primary)
                            : (isDark
                                  ? colors.textSecondary
                                  : Colors.white.withValues(alpha: 0.85)),
                        fontWeight: i == selectedIndex
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
