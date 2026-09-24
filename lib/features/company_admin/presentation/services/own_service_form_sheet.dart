import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../categories/presentation/category_label.dart';
import '../../../categories/presentation/category_providers.dart';

/// Saves a service the company created itself; returns null on success or a
/// user-facing error. An empty price is passed as null, never as 0.
typedef OwnServiceSave = Future<String?> Function({
  required String categoryId,
  required String name,
  required String description,
  required double? price,
  required String note,
});

/// Asks for everything about a service the company creates or edits: its
/// name, description and category, plus the company's own optional price and
/// note.
Future<void> showOwnServiceForm(
  BuildContext context, {
  required OwnServiceSave onSave,
  String? initialName,
  String? initialDescription,
  String? initialCategoryId,
  double? initialPrice,
  String? initialNote,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _OwnServiceForm(
      onSave: onSave,
      initialName: initialName,
      initialDescription: initialDescription,
      initialCategoryId: initialCategoryId,
      initialPrice: initialPrice,
      initialNote: initialNote,
    ),
  );
}

class _OwnServiceForm extends ConsumerStatefulWidget {
  const _OwnServiceForm({
    required this.onSave,
    this.initialName,
    this.initialDescription,
    this.initialCategoryId,
    this.initialPrice,
    this.initialNote,
  });

  final OwnServiceSave onSave;
  final String? initialName;
  final String? initialDescription;
  final String? initialCategoryId;
  final double? initialPrice;
  final String? initialNote;

  bool get isEditing => initialName != null;

  @override
  ConsumerState<_OwnServiceForm> createState() => _OwnServiceFormState();
}

class _OwnServiceFormState extends ConsumerState<_OwnServiceForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _priceController;
  late final TextEditingController _noteController;
  late String? _categoryId;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _categoryId = widget.initialCategoryId;
    _nameController = TextEditingController(text: widget.initialName ?? '');
    _descriptionController =
        TextEditingController(text: widget.initialDescription ?? '');
    final price = widget.initialPrice;
    _priceController = TextEditingController(
      text: price == null
          ? ''
          : (price == price.roundToDouble()
              ? price.toStringAsFixed(0)
              : price.toString()),
    );
    _noteController = TextEditingController(text: widget.initialNote ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _priceController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  String? _validatePrice(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return null;
    final number = double.tryParse(text);
    return number == null || number <= 0
        ? context.l10n.formPriceInvalid
        : null;
  }

  Future<void> _save() async {
    if (_saving || !(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    final error = await widget.onSave(
      categoryId: _categoryId!,
      name: _nameController.text.trim(),
      description: _descriptionController.text.trim(),
      price: double.tryParse(_priceController.text.trim()),
      note: _noteController.text.trim(),
    );
    if (!mounted) return;
    setState(() => _saving = false);
    final messenger = ScaffoldMessenger.of(context);
    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error, messenger: messenger);
      return;
    }
    final savedMessage = context.l10n.adminServiceSaved;
    Navigator.of(context).pop();
    showAppSnackBar(
      context,
      savedMessage,
      tone: AppTone.success,
      messenger: messenger,
    );
  }

  /// Active categories, plus the service's current one if it was deactivated
  /// since, so an unchanged assignment always has a matching item.
  List<Category> _selectable(List<Category> all) {
    final active = [
      for (final category in all)
        if (category.isActive) category,
    ];
    final currentId = widget.initialCategoryId;
    if (currentId == null || active.any((c) => c.id == currentId)) {
      return active;
    }
    for (final category in all) {
      if (category.id == currentId) return [category, ...active];
    }
    return active;
  }

  @override
  Widget build(BuildContext context) {
    final categoriesAsync = ref.watch(allCategoriesProvider);
    final categories = _selectable(categoriesAsync.asData?.value ?? const []);
    final currentIsSelectable =
        _categoryId == null || categories.any((c) => c.id == _categoryId);

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.s16,
        0,
        AppSpacing.s16,
        AppSpacing.s16 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.isEditing
                  ? context.l10n.adminServiceFormEditTitle
                  : context.l10n.adminServiceNew,
              style: AppTextStyles.h2,
            ),
            const SizedBox(height: AppSpacing.s16),
            AppTextField(
              label: context.l10n.adminServiceNameLabel,
              controller: _nameController,
              enabled: !_saving,
              textInputAction: TextInputAction.next,
              prefixIcon: Icons.design_services_outlined,
              validator: (value) => (value ?? '').trim().isEmpty
                  ? context.l10n.adminServiceNameRequired
                  : null,
            ),
            const SizedBox(height: AppSpacing.s12),
            AppDropdownField<String>(
              // The field reads its initial value only once, so it is
              // rebuilt when the saved category becomes one of the items.
              key: ValueKey(currentIsSelectable),
              initialValue: currentIsSelectable ? _categoryId : null,
              label: context.l10n.formCategoryLabel,
              items: [
                for (final category in categories)
                  DropdownMenuItem(
                    value: category.id,
                    child: Text(
                      category.isActive
                          ? category.localizedName(context)
                          : '${category.localizedName(context)} ${context.l10n.formCategoryInactiveSuffix}',
                    ),
                  ),
              ],
              enabled: !_saving,
              onChanged: (value) => setState(() => _categoryId = value),
              validator: (value) => value == null
                  ? context.l10n.adminServiceCategoryRequired
                  : null,
            ),
            const SizedBox(height: AppSpacing.s12),
            AppTextField(
              label: context.l10n.adminServiceDescriptionLabel,
              controller: _descriptionController,
              enabled: !_saving,
              minLines: 2,
              maxLines: 4,
              maxLength: 500,
            ),
            AppTextField(
              label: context.l10n.formPriceOptional,
              controller: _priceController,
              enabled: !_saving,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
              ],
              helperText: context.l10n.adminServicePriceHelper,
              prefixIcon: Icons.payments_outlined,
              validator: _validatePrice,
            ),
            const SizedBox(height: AppSpacing.s12),
            AppTextField(
              label: context.l10n.adminServiceNoteLabel,
              controller: _noteController,
              enabled: !_saving,
              minLines: 2,
              maxLines: 4,
              maxLength: 500,
              hint: context.l10n.adminServiceNoteHint,
            ),
            const SizedBox(height: AppSpacing.s8),
            AppButton.primary(
              label: context.l10n.commonSave,
              loading: _saving,
              expand: true,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}
