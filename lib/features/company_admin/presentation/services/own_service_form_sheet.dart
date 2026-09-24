import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
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
      messenger.showSnackBar(SnackBar(content: Text(error)));
      return;
    }
    final savedMessage = context.l10n.adminServiceSaved;
    Navigator.of(context).pop();
    messenger.showSnackBar(SnackBar(content: Text(savedMessage)));
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
        16,
        0,
        16,
        16 + MediaQuery.viewInsetsOf(context).bottom,
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
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _nameController,
              enabled: !_saving,
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                labelText: context.l10n.adminServiceNameLabel,
                prefixIcon: const Icon(Icons.design_services_outlined),
              ),
              validator: (value) => (value ?? '').trim().isEmpty
                  ? context.l10n.adminServiceNameRequired
                  : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              // The field reads its initial value only once, so it is
              // rebuilt when the saved category becomes one of the items.
              key: ValueKey(currentIsSelectable),
              initialValue: currentIsSelectable ? _categoryId : null,
              decoration: InputDecoration(
                labelText: context.l10n.formCategoryLabel,
                prefixIcon: const Icon(Icons.category_outlined),
              ),
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
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _categoryId = value),
              validator: (value) => value == null
                  ? context.l10n.adminServiceCategoryRequired
                  : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descriptionController,
              enabled: !_saving,
              minLines: 2,
              maxLines: 4,
              maxLength: 500,
              decoration: InputDecoration(
                labelText: context.l10n.adminServiceDescriptionLabel,
                alignLabelWithHint: true,
              ),
            ),
            TextFormField(
              controller: _priceController,
              enabled: !_saving,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
              ],
              decoration: InputDecoration(
                labelText: context.l10n.formPriceOptional,
                helperText: context.l10n.adminServicePriceHelper,
                helperMaxLines: 2,
                prefixIcon: const Icon(Icons.payments_outlined),
              ),
              validator: _validatePrice,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _noteController,
              enabled: !_saving,
              minLines: 2,
              maxLines: 4,
              maxLength: 500,
              decoration: InputDecoration(
                labelText: context.l10n.adminServiceNoteLabel,
                hintText: context.l10n.adminServiceNoteHint,
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.2),
                    )
                  : Text(context.l10n.commonSave),
            ),
          ],
        ),
      ),
    );
  }
}
