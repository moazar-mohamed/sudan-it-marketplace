import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import '../theme/app_text_styles.dart';

/// Underlined tabs (Figma component "Tabs"): Products / Services / Companies
/// on Home, Products / Services on Orders. The selected tab is brand blue with
/// a 3 px indicator; order follows the reading direction.
class AppUnderlineTabs extends StatelessWidget {
  const AppUnderlineTabs({
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
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.borderDefault)),
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: Semantics(
                button: true,
                selected: i == selectedIndex,
                child: InkWell(
                  onTap: () => onChanged(i),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        height: 44,
                        alignment: Alignment.center,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.s8,
                        ),
                        child: Text(
                          labels[i],
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.labelLarge.copyWith(
                            color: i == selectedIndex
                                ? AppColors.textBrand
                                : AppColors.textSecondary,
                            fontWeight: i == selectedIndex
                                ? FontWeight.w700
                                : FontWeight.w500,
                          ),
                        ),
                      ),
                      Container(
                        height: 3,
                        decoration: BoxDecoration(
                          color: i == selectedIndex
                              ? AppColors.primary
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// [AppUnderlineTabs] over swipeable pages: the tab labels and the page bodies
/// stay in step whether the user taps a tab or swipes. Pages are built when
/// they are shown, so a tab that is never opened loads nothing.
class AppTabbedView extends StatefulWidget {
  const AppTabbedView({
    super.key,
    required this.labels,
    required this.children,
  });

  final List<String> labels;
  final List<Widget> children;

  @override
  State<AppTabbedView> createState() => _AppTabbedViewState();
}

class _AppTabbedViewState extends State<AppTabbedView>
    with SingleTickerProviderStateMixin {
  late final TabController _controller =
      TabController(length: widget.labels.length, vsync: this);

  @override
  void initState() {
    super.initState();
    assert(widget.labels.length == widget.children.length);
    _controller.addListener(_onChanged);
  }

  void _onChanged() => setState(() {});

  @override
  void dispose() {
    _controller
      ..removeListener(_onChanged)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AppUnderlineTabs(
          labels: widget.labels,
          selectedIndex: _controller.index,
          onChanged: _controller.animateTo,
        ),
        Expanded(
          child: TabBarView(
            controller: _controller,
            children: widget.children,
          ),
        ),
      ],
    );
  }
}

/// One-choice filter chips in a horizontally scrolling row (status filters on
/// orders and requests, category filters on products).
class AppFilterChips extends StatelessWidget {
  const AppFilterChips({
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
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++) ...[
            if (i > 0) const SizedBox(width: AppSpacing.s8),
            ChoiceChip(
              label: Text(labels[i]),
              selected: i == selectedIndex,
              onSelected: (_) => onChanged(i),
              side: BorderSide(
                color: i == selectedIndex
                    ? AppColors.primary
                    : AppColors.borderInput,
              ),
              visualDensity: VisualDensity.standard,
              labelStyle: AppTextStyles.labelLarge.copyWith(
                color: i == selectedIndex
                    ? AppColors.textBrand
                    : AppColors.textPrimary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A selectable option shown as a card with a radio mark (installation yes/no,
/// delivery choices). Selection is shown by the mark, the border weight and the
/// text weight, not by colour alone.
class AppOptionCard extends StatelessWidget {
  const AppOptionCard({
    super.key,
    required this.title,
    required this.selected,
    required this.onTap,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      child: Material(
        color: selected ? AppColors.brandPrimarySubtle : AppColors.surface,
        borderRadius: AppRadius.smAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.smAll,
          child: Container(
            constraints: const BoxConstraints(minHeight: AppSize.touchMin),
            padding: const EdgeInsets.symmetric(
              vertical: AppSpacing.s12,
              horizontal: AppSpacing.s8,
            ),
            decoration: BoxDecoration(
              borderRadius: AppRadius.smAll,
              border: Border.all(
                color: selected ? AppColors.primary : AppColors.borderInput,
                width: selected ? AppBorder.thick : AppBorder.thin,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  selected
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked,
                  color: selected ? AppColors.primary : AppColors.iconMuted,
                  size: AppSize.iconMd,
                ),
                const SizedBox(height: AppSpacing.s6),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: AppTextStyles.labelLarge.copyWith(
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color:
                        selected ? AppColors.textBrand : AppColors.textPrimary,
                  ),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    textAlign: TextAlign.center,
                    style: AppTextStyles.caption.copyWith(
                      color: selected
                          ? AppColors.textBrand
                          : AppColors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
