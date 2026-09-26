import 'package:flutter/material.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../customer_dashboard/presentation/widgets/category_grid.dart'
    show categoryIconFor;
import '../domain/category_tree.dart';
import '../domain/entities/category.dart';

/// What the picker sheet returns: the chosen category, where a null id means
/// "no category". Dismissing the sheet returns null instead of a [CategoryPick].
class CategoryPick {
  const CategoryPick(this.id);

  final String? id;
}

/// Opens the category chooser: a sheet that walks down a [tree] level by level
/// (with a breadcrumb back up) or searches it by Arabic or English name. Only
/// categories that customers can see (active, under active parents) are
/// offered; any of them, at any level, can be chosen.
Future<CategoryPick?> showCategoryPicker(
  BuildContext context, {
  required CategoryTree tree,
  required String? selectedId,
  bool allowNone = true,
}) {
  return showModalBottomSheet<CategoryPick>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (_, controller) => _CategorySheet(
        tree: tree,
        selectedId: selectedId,
        allowNone: allowNone,
        scrollController: controller,
      ),
    ),
  );
}

class _CategorySheet extends StatefulWidget {
  const _CategorySheet({
    required this.tree,
    required this.selectedId,
    required this.allowNone,
    required this.scrollController,
  });

  final CategoryTree tree;
  final String? selectedId;
  final bool allowNone;
  final ScrollController scrollController;

  @override
  State<_CategorySheet> createState() => _CategorySheetState();
}

class _CategorySheetState extends State<_CategorySheet> {
  final _searchController = TextEditingController();
  String _query = '';

  /// The category whose children are listed; null = the top level.
  late String? _current = _startingLevel();

  /// Opens at the level of the current choice, so it is right there to change.
  String? _startingLevel() {
    final selected = widget.selectedId;
    if (selected == null || !widget.tree.isEffectivelyActive(selected)) {
      return null;
    }
    return widget.tree.byId(selected)?.parentId;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _pick(String? id) => Navigator.of(context).pop(CategoryPick(id));

  @override
  Widget build(BuildContext context) {
    final language = Localizations.localeOf(context).languageCode;
    final searching = _query.trim().isNotEmpty;
    return ListView(
      controller: widget.scrollController,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.s16,
        0,
        AppSpacing.s16,
        AppSpacing.s24,
      ),
      children: [
        Text(context.l10n.categoryPickerTitle, style: AppTextStyles.h2),
        const SizedBox(height: AppSpacing.s12),
        AppSearchField(
          key: const ValueKey('category-search'),
          controller: _searchController,
          hint: context.l10n.categorySearchHint,
          onChanged: (value) => setState(() => _query = value),
          onCleared: () => setState(() {
            _searchController.clear();
            _query = '';
          }),
        ),
        const SizedBox(height: AppSpacing.s12),
        if (searching)
          ..._results(context, language)
        else ...[
          _Breadcrumb(
            tree: widget.tree,
            current: _current,
            language: language,
            onGo: (id) => setState(() => _current = id),
          ),
          const SizedBox(height: AppSpacing.s8),
          if (widget.allowNone)
            _Row(
              key: const ValueKey('category-none'),
              title: context.l10n.formCategoryNone,
              selected: widget.selectedId == null,
              onTap: () => _pick(null),
            ),
          ..._level(context, language),
        ],
      ],
    );
  }

  List<Widget> _level(BuildContext context, String language) {
    final children = widget.tree.activeChildrenOf(_current);
    if (children.isEmpty && _current == null) {
      return [_Empty(context.l10n.categoryTreeEmpty)];
    }
    return [
      for (final category in children)
        _categoryRow(context, category, language),
    ];
  }

  Widget _categoryRow(
    BuildContext context,
    Category category,
    String language,
  ) {
    final hasChildren = widget.tree.activeChildrenOf(category.id).isNotEmpty;
    final selected = category.id == widget.selectedId;
    return _Row(
      key: ValueKey('category-row-${category.id}'),
      title: category.nameFor(language),
      icon: categoryIconFor(category),
      selected: selected,
      subtitle: hasChildren
          ? context.l10n.categorySubCount(
              widget.tree.activeChildrenOf(category.id).length,
            )
          : null,
      // A category with sub-categories opens; the button beside it chooses it.
      onTap: hasChildren
          ? () => setState(() => _current = category.id)
          : () => _pick(category.id),
      trailing: hasChildren
          ? TextButton(
              key: ValueKey('category-select-${category.id}'),
              onPressed: () => _pick(category.id),
              child: Text(context.l10n.categorySelect),
            )
          : null,
      showChevron: hasChildren,
    );
  }

  List<Widget> _results(BuildContext context, String language) {
    final matches = widget.tree.search(_query);
    if (matches.isEmpty) return [_Empty(context.l10n.categoryNoResults)];
    return [
      for (final category in matches)
        _Row(
          key: ValueKey('category-result-${category.id}'),
          title: category.nameFor(language),
          subtitle: widget.tree.pathLabel(category.id, language),
          icon: categoryIconFor(category),
          selected: category.id == widget.selectedId,
          onTap: () => _pick(category.id),
        ),
    ];
  }
}

class _Breadcrumb extends StatelessWidget {
  const _Breadcrumb({
    required this.tree,
    required this.current,
    required this.language,
    required this.onGo,
  });

  final CategoryTree tree;
  final String? current;
  final String language;
  final ValueChanged<String?> onGo;

  @override
  Widget build(BuildContext context) {
    final path = current == null ? const <Category>[] : tree.pathOf(current!);
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _Crumb(
          key: const ValueKey('category-crumb-root'),
          label: context.l10n.categoryRootCrumb,
          onTap: current == null ? null : () => onGo(null),
        ),
        for (final category in path) ...[
          const Icon(
            Icons.chevron_right_rounded,
            size: AppSize.iconSm,
            color: AppColors.textSecondary,
          ),
          _Crumb(
            key: ValueKey('category-crumb-${category.id}'),
            label: category.nameFor(language),
            onTap: category.id == current ? null : () => onGo(category.id),
          ),
        ],
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

class _Row extends StatelessWidget {
  const _Row({
    super.key,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.icon,
    this.trailing,
    this.selected = false,
    this.showChevron = false,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? trailing;
  final bool selected;
  final bool showChevron;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      selected: selected,
      selectedColor: AppColors.textBrand,
      selectedTileColor: AppColors.brandPrimarySubtle,
      contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.s8),
      leading: icon == null ? null : Icon(icon, color: AppColors.primary),
      title: Text(title, style: AppTextStyles.body),
      subtitle: subtitle == null
          ? null
          : Text(subtitle!, style: AppTextStyles.caption),
      trailing: trailing != null || showChevron || selected
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ?trailing,
                if (selected)
                  const Icon(Icons.check_rounded, color: AppColors.primary),
                if (showChevron)
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textSecondary,
                  ),
              ],
            )
          : null,
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty(this.message);

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(AppSpacing.s24),
    child: Center(
      child: Text(
        message,
        style: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
        textAlign: TextAlign.center,
      ),
    ),
  );
}

/// A form field for choosing one category of [tree] (or none): shows the full
/// path of the choice and opens [showCategoryPicker] when tapped. A category
/// that was deactivated since it was chosen still shows, marked inactive, so
/// editing a product never silently changes it; a missing one says so.
class CategoryPickerField extends StatelessWidget {
  const CategoryPickerField({
    super.key,
    required this.tree,
    required this.value,
    required this.onChanged,
    this.label,
    this.enabled = true,
    this.allowNone = true,
    this.validator,
  });

  final CategoryTree tree;
  final String? value;
  final ValueChanged<String?> onChanged;
  final String? label;
  final bool enabled;
  final bool allowNone;
  final FormFieldValidator<String?>? validator;

  String? _display(BuildContext context) {
    final id = value;
    if (id == null) return allowNone ? context.l10n.formCategoryNone : null;
    final category = tree.byId(id);
    if (category == null) return context.l10n.categoryUnavailable;
    final language = Localizations.localeOf(context).languageCode;
    final path = tree.pathLabel(id, language);
    return tree.isEffectivelyActive(id)
        ? path
        : '$path ${context.l10n.formCategoryInactiveSuffix}';
  }

  Future<void> _open(BuildContext context) async {
    final pick = await showCategoryPicker(
      context,
      tree: tree,
      selectedId: value,
      allowNone: allowNone,
    );
    if (pick != null) onChanged(pick.id);
  }

  @override
  Widget build(BuildContext context) {
    return AppSelectorField(
      label: label,
      value: value,
      display: _display(context),
      hint: context.l10n.categoryPickerTitle,
      enabled: enabled,
      validator: validator,
      onTap: () => _open(context),
    );
  }
}
