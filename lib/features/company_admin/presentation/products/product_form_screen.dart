import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/image_upload_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/image_picker_field.dart';
import '../../../../core/widgets/image_picker_strings.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../products/domain/entities/product.dart';
import '../company_admin_actions.dart';
import '../../../../core/localization/l10n_extension.dart';

/// Add Product and Edit Product share this form and its rules:
/// installation price is only shown and required when installation is on.
class ProductFormScreen extends ConsumerStatefulWidget {
  const ProductFormScreen.add({super.key, required this.companyId})
      : product = null;

  ProductFormScreen.edit({super.key, required Product this.product})
      : companyId = product.companyId ?? '';

  final String companyId;
  final Product? product;

  bool get isEditing => product != null;

  @override
  ConsumerState<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _SpecRow {
  _SpecRow({String key = '', String value = ''})
      : keyController = TextEditingController(text: key),
        valueController = TextEditingController(text: value);

  final TextEditingController keyController;
  final TextEditingController valueController;

  void dispose() {
    keyController.dispose();
    valueController.dispose();
  }
}

class _ProductFormScreenState extends ConsumerState<ProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final ImagePickerController _imageController;
  late final TextEditingController _priceController;
  late final TextEditingController _stockController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _installationPriceController;
  final List<_SpecRow> _specRows = [];

  late bool _inStock;
  late bool _deliveryAvailable;
  late bool _installationAvailable;
  late String? _categoryId;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final product = widget.product;
    _categoryId = product?.categoryId;
    _nameController = TextEditingController(text: product?.name ?? '');
    _imageController = ImagePickerController(url: product?.imageUrl);
    _priceController = TextEditingController(
      text: product?.price == null ? '' : _numberText(product!.price!),
    );
    _stockController = TextEditingController(
      text: product == null ? '' : '${product.stockCount}',
    );
    _descriptionController =
        TextEditingController(text: product?.description ?? '');
    _installationPriceController = TextEditingController(
      text: product?.installationPrice == null
          ? ''
          : _numberText(product!.installationPrice!),
    );
    _inStock = product?.inStock ?? true;
    _deliveryAvailable = product?.isDeliveryAvailable ?? true;
    _installationAvailable = product?.isInstallationAvailable ?? false;
    for (final entry in product?.specifications.entries ??
        const <MapEntry<String, String>>[]) {
      _specRows.add(_SpecRow(key: entry.key, value: entry.value));
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _imageController.dispose();
    _priceController.dispose();
    _stockController.dispose();
    _descriptionController.dispose();
    _installationPriceController.dispose();
    for (final row in _specRows) {
      row.dispose();
    }
    super.dispose();
  }

  static String _numberText(double value) {
    return value == value.roundToDouble()
        ? value.toStringAsFixed(0)
        : value.toString();
  }

  static final _decimalFormatter =
      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'));

  String? _validatePositiveNumber(
    String? value, {
    required String requiredMessage,
    required String invalidMessage,
  }) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return requiredMessage;
    }
    final number = double.tryParse(text);
    if (number == null || number <= 0) {
      return invalidMessage;
    }
    return null;
  }

  /// The price may be left empty; when given it must still be greater than 0.
  String? _validateOptionalPrice(String? value) {
    if ((value?.trim() ?? '').isEmpty) {
      return null;
    }
    return _validatePositiveNumber(
      value,
      requiredMessage: context.l10n.formPriceInvalid,
      invalidMessage: context.l10n.formPriceInvalid,
    );
  }

  /// Active categories, plus the product's current category if the Platform
  /// Admin has since deactivated it — so an existing, unchanged assignment
  /// always has a matching dropdown item instead of crashing the widget.
  List<Category> _selectableCategories(List<Category> allCategories) {
    final active = [
      for (final category in allCategories)
        if (category.isActive) category,
    ];
    final currentId = _categoryId;
    if (currentId == null || active.any((c) => c.id == currentId)) {
      return active;
    }
    for (final category in allCategories) {
      if (category.id == currentId) {
        return [category, ...active];
      }
    }
    return active;
  }

  void _addSpecRow() {
    setState(() => _specRows.add(_SpecRow()));
  }

  void _removeSpecRow(int index) {
    final row = _specRows.removeAt(index);
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) => row.dispose());
  }

  Future<void> _save() async {
    if (_isSaving) {
      return;
    }
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final specifications = <String, String>{};
    for (final row in _specRows) {
      final key = row.keyController.text.trim();
      final value = row.valueController.text.trim();
      if (key.isNotEmpty && value.isNotEmpty) {
        specifications[key] = value;
      }
    }

    setState(() => _isSaving = true);

    final String imageUrl;
    try {
      imageUrl = await _imageController.resolveUrl(
        ref.read(imageUploadServiceProvider),
        folder: 'product-images/${widget.companyId}',
      );
    } on ImageUploadException {
      if (!mounted) {
        return;
      }
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ImagePickerStrings.of(context).uploadFailed),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final actions = ref.read(companyAdminActionsProvider);
    final existing = widget.product;
    final companyName = existing?.companyName ??
        ref.read(companyStreamProvider(widget.companyId)).asData?.value?.name ??
        '';

    final product = Product(
      id: existing?.id ?? actions.newProductId(),
      companyId: widget.companyId,
      companyName: companyName,
      name: _nameController.text.trim(),
      imageUrl: imageUrl,
      categoryId: _categoryId,
      // Optional: an empty field saves no price (null), never 0.
      price: double.tryParse(_priceController.text.trim()),
      currency: existing?.currency ?? 'SDG',
      stockCount: int.parse(_stockController.text.trim()),
      inStock: _inStock,
      description: _descriptionController.text.trim(),
      specifications: specifications,
      isDeliveryAvailable: _deliveryAvailable,
      isInstallationAvailable: _installationAvailable,
      installationPrice: _installationAvailable
          ? double.parse(_installationPriceController.text.trim())
          : null,
    );

    final error = existing == null
        ? await actions.createProduct(product)
        : await actions.updateProduct(product);
    if (!mounted) {
      return;
    }
    setState(() => _isSaving = false);

    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error), backgroundColor: AppColors.error),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(existing == null ? context.l10n.formProductAdded : context.l10n.formProductUpdated),
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textTheme = theme.textTheme;
    final colorScheme = theme.colorScheme;
    final categoriesAsync = ref.watch(allCategoriesProvider);
    final categoriesLoaded = categoriesAsync.hasValue;
    final selectableCategories =
        _selectableCategories(categoriesAsync.asData?.value ?? const []);
    // Firestore may first emit an empty snapshot from its cache, so "loaded"
    // is not enough: the saved category must actually be among the items.
    final currentIsSelectable = _categoryId == null ||
        selectableCategories.any((category) => category.id == _categoryId);

    Widget sectionTitle(String title) => Padding(
          padding: const EdgeInsets.only(top: 20, bottom: 10),
          child: Text(
            title,
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        );

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isEditing ? context.l10n.adminEditProduct : context.l10n.adminAddProduct),
      ),
      body: SafeArea(
        top: false,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              16,
              8,
              16,
              MediaQuery.viewInsetsOf(context).bottom + 24,
            ),
            children: [
              sectionTitle(context.l10n.adminProduct),
              TextFormField(
                controller: _nameController,
                enabled: !_isSaving,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(
                  labelText: context.l10n.formProductName,
                  prefixIcon: Icon(Icons.inventory_2_outlined),
                ),
                validator: (value) => (value?.trim().isEmpty ?? true)
                    ? context.l10n.formProductNameRequired
                    : null,
              ),
              const SizedBox(height: 14),
              ImagePickerField(
                controller: _imageController,
                enabled: !_isSaving,
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String?>(
                // The field only reads its initial value once, so it is
                // rebuilt when the saved category becomes selectable; until
                // then it is kept in state only.
                key: ValueKey(currentIsSelectable),
                initialValue: currentIsSelectable ? _categoryId : null,
                decoration: InputDecoration(
                  labelText: context.l10n.formCategoryLabel,
                  prefixIcon: const Icon(Icons.category_outlined),
                ),
                items: [
                  DropdownMenuItem<String?>(
                    value: null,
                    child: Text(context.l10n.formCategoryNone),
                  ),
                  for (final category in selectableCategories)
                    DropdownMenuItem<String?>(
                      value: category.id,
                      child: Text(
                        category.isActive
                            ? category.name
                            : '${category.name} ${context.l10n.formCategoryInactiveSuffix}',
                      ),
                    ),
                ],
                onChanged: _isSaving || !categoriesLoaded
                    ? null
                    : (value) => setState(() => _categoryId = value),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _priceController,
                enabled: !_isSaving,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [_decimalFormatter],
                decoration: InputDecoration(
                  labelText: context.l10n.formPriceOptional,
                  prefixIcon: Icon(Icons.payments_outlined),
                ),
                validator: _validateOptionalPrice,
              ),
              sectionTitle(context.l10n.formStockSection),
              TextFormField(
                controller: _stockController,
                enabled: !_isSaving,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  labelText: context.l10n.formStockQuantity,
                  prefixIcon: Icon(Icons.warehouse_outlined),
                ),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty || int.tryParse(text) == null) {
                    return context.l10n.formStockRequired;
                  }
                  return null;
                },
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _inStock,
                onChanged: _isSaving
                    ? null
                    : (value) => setState(() => _inStock = value),
                title: Text(context.l10n.formAvailableForSale),
                subtitle: Text(
                  context.l10n.formAvailableHint,
                ),
              ),
              sectionTitle(context.l10n.productDescription),
              TextFormField(
                controller: _descriptionController,
                enabled: !_isSaving,
                minLines: 3,
                maxLines: 6,
                decoration: InputDecoration(
                  labelText: context.l10n.productDescription,
                  alignLabelWithHint: true,
                ),
              ),
              sectionTitle(context.l10n.productSpecifications),
              for (int i = 0; i < _specRows.length; i++) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 2,
                      child: TextFormField(
                        controller: _specRows[i].keyController,
                        enabled: !_isSaving,
                        decoration: InputDecoration(labelText: context.l10n.formSpecName),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: TextFormField(
                        controller: _specRows[i].valueController,
                        enabled: !_isSaving,
                        decoration: InputDecoration(labelText: context.l10n.formSpecValue),
                      ),
                    ),
                    IconButton(
                      tooltip: context.l10n.commonRemove,
                      onPressed: _isSaving ? null : () => _removeSpecRow(i),
                      icon: Icon(
                        Icons.remove_circle_outline,
                        color: colorScheme.error,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
              ],
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton.icon(
                  onPressed: _isSaving ? null : _addSpecRow,
                  icon: const Icon(Icons.add),
                  label: Text(context.l10n.formAddSpec),
                ),
              ),
              sectionTitle(context.l10n.checkoutDelivery),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _deliveryAvailable,
                onChanged: _isSaving
                    ? null
                    : (value) => setState(() => _deliveryAvailable = value),
                title: Text(context.l10n.formDeliveryAvailable),
                subtitle: Text(
                  _deliveryAvailable
                      ? context.l10n.formDeliveryOn
                      : context.l10n.formDeliveryOff,
                ),
              ),
              sectionTitle(context.l10n.pendingInstallation),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _installationAvailable,
                onChanged: _isSaving
                    ? null
                    : (value) =>
                        setState(() => _installationAvailable = value),
                title: Text(context.l10n.formInstallationAvailable),
                subtitle: Text(
                  _installationAvailable
                      ? context.l10n.formInstallationOn
                      : context.l10n.formInstallationOff,
                ),
              ),
              if (_installationAvailable) ...[
                const SizedBox(height: 8),
                TextFormField(
                  controller: _installationPriceController,
                  enabled: !_isSaving,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [_decimalFormatter],
                  decoration: InputDecoration(
                    labelText: context.l10n.formInstallationPrice,
                    prefixIcon: Icon(Icons.handyman_outlined),
                  ),
                  validator: (value) => _validatePositiveNumber(
                    value,
                    requiredMessage: context.l10n.formInstallationPriceRequired,
                    invalidMessage: context.l10n.formInstallationPriceInvalid,
                  ),
                ),
              ],
              const SizedBox(height: 28),
              ElevatedButton(
                onPressed: _isSaving ? null : _save,
                child: _isSaving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: AppColors.onPrimary,
                        ),
                      )
                    : Text(widget.isEditing ? context.l10n.commonSaveChanges : context.l10n.adminAddProduct),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
