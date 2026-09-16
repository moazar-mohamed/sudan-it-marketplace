import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../products/domain/entities/product.dart';
import '../company_admin_actions.dart';
import '../widgets/admin_network_image.dart';

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
  late final TextEditingController _imageUrlController;
  late final TextEditingController _priceController;
  late final TextEditingController _stockController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _installationPriceController;
  final List<_SpecRow> _specRows = [];

  late bool _inStock;
  late bool _deliveryAvailable;
  late bool _installationAvailable;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final product = widget.product;
    _nameController = TextEditingController(text: product?.name ?? '');
    _imageUrlController = TextEditingController(text: product?.imageUrl ?? '');
    _priceController = TextEditingController(
      text: product == null ? '' : _numberText(product.price),
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
    _imageUrlController.dispose();
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

  String? _validatePositiveNumber(String? value, String field) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return '$field is required.';
    }
    final number = double.tryParse(text);
    if (number == null || number <= 0) {
      return 'Enter a valid $field greater than 0.';
    }
    return null;
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
      imageUrl: _imageUrlController.text.trim(),
      price: double.parse(_priceController.text.trim()),
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

    setState(() => _isSaving = true);
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
        content: Text(existing == null ? 'Product added.' : 'Product updated.'),
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textTheme = theme.textTheme;
    final colorScheme = theme.colorScheme;

    Widget sectionTitle(String title) => Padding(
          padding: const EdgeInsets.only(top: 20, bottom: 10),
          child: Text(
            title,
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        );

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isEditing ? 'Edit Product' : 'Add Product'),
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
              sectionTitle('Product'),
              TextFormField(
                controller: _nameController,
                enabled: !_isSaving,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Product Name',
                  prefixIcon: Icon(Icons.inventory_2_outlined),
                ),
                validator: (value) => (value?.trim().isEmpty ?? true)
                    ? 'Product name is required.'
                    : null,
              ),
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _imageUrlController,
                    builder: (context, value, _) => AdminNetworkImage(
                      url: value.text,
                      fallbackIcon: Icons.image_outlined,
                      size: 56,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _imageUrlController,
                      enabled: !_isSaving,
                      keyboardType: TextInputType.url,
                      decoration: const InputDecoration(
                        labelText: 'Product Image URL',
                        hintText: 'https://…',
                      ),
                      validator: (value) {
                        final text = value?.trim() ?? '';
                        if (text.isEmpty) {
                          return null;
                        }
                        final uri = Uri.tryParse(text);
                        if (uri == null ||
                            !(uri.scheme == 'http' || uri.scheme == 'https')) {
                          return 'Enter a valid image link (http/https).';
                        }
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _priceController,
                enabled: !_isSaving,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [_decimalFormatter],
                decoration: const InputDecoration(
                  labelText: 'Price (SDG)',
                  prefixIcon: Icon(Icons.payments_outlined),
                ),
                validator: (value) => _validatePositiveNumber(value, 'price'),
              ),
              sectionTitle('Stock / Availability'),
              TextFormField(
                controller: _stockController,
                enabled: !_isSaving,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  labelText: 'Stock Quantity',
                  prefixIcon: Icon(Icons.warehouse_outlined),
                ),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty || int.tryParse(text) == null) {
                    return 'Enter the stock quantity (0 or more).';
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
                title: const Text('Available for sale'),
                subtitle: const Text(
                  'Customers can buy this product while it has stock.',
                ),
              ),
              sectionTitle('Description'),
              TextFormField(
                controller: _descriptionController,
                enabled: !_isSaving,
                minLines: 3,
                maxLines: 6,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  alignLabelWithHint: true,
                ),
              ),
              sectionTitle('Specifications'),
              for (int i = 0; i < _specRows.length; i++) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 2,
                      child: TextFormField(
                        controller: _specRows[i].keyController,
                        enabled: !_isSaving,
                        decoration: const InputDecoration(labelText: 'Name'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: TextFormField(
                        controller: _specRows[i].valueController,
                        enabled: !_isSaving,
                        decoration: const InputDecoration(labelText: 'Value'),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Remove',
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
                  label: const Text('Add specification'),
                ),
              ),
              sectionTitle('Delivery'),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _deliveryAvailable,
                onChanged: _isSaving
                    ? null
                    : (value) => setState(() => _deliveryAvailable = value),
                title: const Text('Delivery Available'),
                subtitle: Text(
                  _deliveryAvailable
                      ? 'Customers can choose delivery at checkout.'
                      : 'Customers collect this product from your pickup location.',
                ),
              ),
              sectionTitle('Installation'),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _installationAvailable,
                onChanged: _isSaving
                    ? null
                    : (value) =>
                        setState(() => _installationAvailable = value),
                title: const Text('Installation Available'),
                subtitle: Text(
                  _installationAvailable
                      ? 'Customers can choose Product + Installation.'
                      : 'Customers will not see any installation option.',
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
                  decoration: const InputDecoration(
                    labelText: 'Installation Price (SDG)',
                    prefixIcon: Icon(Icons.handyman_outlined),
                  ),
                  validator: (value) =>
                      _validatePositiveNumber(value, 'installation price'),
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
                    : Text(widget.isEditing ? 'Save Changes' : 'Add Product'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
