import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/image_upload_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../../core/widgets/image_picker_field.dart';
import '../../../../core/widgets/image_picker_strings.dart';
import '../../../categories/presentation/category_picker.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../customer_dashboard/presentation/widgets/category_browse.dart'
    show brandsOf;
import '../../../offers/presentation/offer_price.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/usd_pricing.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/usd_format.dart';
import '../company_admin_actions.dart';
import '../company_admin_format.dart';
import '../dashboard/usd_rate_card.dart';
import '../../../../core/localization/l10n_extension.dart';

/// Add Product and Edit Product share this form and its rules:
/// installation price is only shown and required when installation is on.
/// The prices are typed in pounds, or in dollars: the pounds are then worked
/// out from the company's dollar rate (kept on its Home), shown under each
/// field, and saved beside the dollars.
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
  late final TextEditingController _brandController;
  late final ImagePickerController _imageController;
  late final TextEditingController _priceController;
  late final TextEditingController _stockController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _installationPriceController;
  final List<_SpecRow> _specRows = [];

  late bool _inStock;
  late bool _deliveryAvailable;
  late bool _installationAvailable;

  /// The prices are typed in US dollars.
  late bool _inUsd;
  late String? _categoryId;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final product = widget.product;
    _categoryId = product?.categoryId;
    _nameController = TextEditingController(text: product?.name ?? '');
    _brandController = TextEditingController(text: product?.brand ?? '');
    _imageController = ImagePickerController(url: product?.imageUrl);
    _inUsd = product?.isPricedInUsd ?? false;
    final typedPrice = _inUsd ? product!.priceUsd : product?.price;
    _priceController = TextEditingController(
      text: typedPrice == null ? '' : _numberText(typedPrice),
    );
    _stockController = TextEditingController(
      text: product == null ? '' : '${product.stockCount}',
    );
    _descriptionController = TextEditingController(
      text: product?.description ?? '',
    );
    final typedInstallation =
        _inUsd ? product!.installationPriceUsd : product?.installationPrice;
    _installationPriceController = TextEditingController(
      text: typedInstallation == null ? '' : _numberText(typedInstallation),
    );
    _inStock = product?.inStock ?? true;
    _deliveryAvailable = product?.isDeliveryAvailable ?? true;
    _installationAvailable = product?.isInstallationAvailable ?? false;
    for (final entry
        in product?.specifications.entries ??
            const <MapEntry<String, String>>[]) {
      _specRows.add(_SpecRow(key: entry.key, value: entry.value));
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _brandController.dispose();
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

  static final _decimalFormatter = FilteringTextInputFormatter.allow(
    RegExp(r'[0-9.]'),
  );

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

  /// The company's dollar rate; null until it sets one.
  double? get _usdRate =>
      ref.read(companyStreamProvider(widget.companyId)).asData?.value?.usdRate;

  /// The pounds the dollars in [text] come to at the company's rate, or null.
  double? _inPounds(String text) {
    final usd = double.tryParse(text.trim());
    final rate = _usdRate;
    return usd == null || usd <= 0 || rate == null
        ? null
        : UsdPricing.price(usd, rate);
  }

  /// What a field typed in dollars comes to in pounds, under the field.
  String? _poundsHelper(String text) {
    final pounds = _inPounds(text);
    final rate = _usdRate;
    return !_inUsd || pounds == null || rate == null
        ? null
        : context.l10n.formUsdEquals(
            formatProductPrice(pounds),
            formatUsdAmount(rate),
          );
  }

  /// The price may be left empty; when given it must still be greater than 0,
  /// and above the price of an offer that is running on the product. In
  /// dollars it is needed, and so is the company's rate.
  String? _validateOptionalPrice(String? value) {
    if (_inUsd) return _validateUsdPrice(value);
    final existing = widget.product;
    final offer = existing != null && existing.hasActiveOffer
        ? existing.offerPrice
        : null;
    final price = double.tryParse(value?.trim() ?? '');
    if (offer != null && (price == null || price <= offer)) {
      return context.l10n.formPriceBelowOffer(
        CompanyAdminFormat.price(offer, existing!.currency),
      );
    }
    if ((value?.trim() ?? '').isEmpty) {
      return null;
    }
    return _validatePositiveNumber(
      value,
      requiredMessage: context.l10n.formPriceInvalid,
      invalidMessage: context.l10n.formPriceInvalid,
    );
  }

  String? _validateUsdPrice(String? value) {
    if (_usdRate == null) return context.l10n.formUsdNeedsRate;
    final usd = double.tryParse(value?.trim() ?? '');
    if (usd == null || usd <= 0) return context.l10n.formPriceUsdRequired;
    final existing = widget.product;
    if (existing != null && existing.hasActiveOffer) {
      final offerUsd = existing.offerPriceUsd;
      final offer = existing.offerPrice!;
      if ((offerUsd != null && usd <= offerUsd) || _inPounds(value!)! <= offer) {
        return context.l10n.formPriceBelowOffer(
          offerUsd != null
              ? '${formatUsdAmount(offerUsd)} \$'
              : CompanyAdminFormat.price(offer),
        );
      }
    }
    return null;
  }

  void _setUsdRate() => showUsdRateSheet(
        context,
        companyId: widget.companyId,
        currentRate: _usdRate,
        products:
            ref.read(companyProductsStreamProvider(widget.companyId)).asData?.value ??
                const [],
      );

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
      showAppSnackBar(
        context,
        ImagePickerStrings.of(context).uploadFailed,
        tone: AppTone.error,
      );
      return;
    }

    final actions = ref.read(companyAdminActionsProvider);
    final existing = widget.product;
    final companyName =
        existing?.companyName ??
        ref.read(companyStreamProvider(widget.companyId)).asData?.value?.name ??
        '';

    // In dollars, the pounds are worked out from the company's rate (the
    // validators made sure there is one) and saved beside the dollars.
    final rate = _inUsd ? _usdRate! : null;
    final typedPrice = double.tryParse(_priceController.text.trim());
    final typedInstallation = _installationAvailable
        ? double.parse(_installationPriceController.text.trim())
        : null;
    final keepsOffer = existing != null && existing.hasActiveOffer;
    final offerUsd = keepsOffer && rate != null ? existing.offerPriceUsd : null;

    final product = Product(
      id: existing?.id ?? actions.newProductId(),
      companyId: widget.companyId,
      companyName: companyName,
      name: _nameController.text.trim(),
      brand: _brandController.text.trim(),
      imageUrl: imageUrl,
      categoryId: _categoryId,
      // Optional: an empty field saves no price (null), never 0.
      price: rate == null ? typedPrice : UsdPricing.price(typedPrice!, rate),
      currency: existing?.currency ?? 'SDG',
      stockCount: int.parse(_stockController.text.trim()),
      inStock: _inStock,
      description: _descriptionController.text.trim(),
      specifications: specifications,
      isDeliveryAvailable: _deliveryAvailable,
      isInstallationAvailable: _installationAvailable,
      installationPrice: rate == null || typedInstallation == null
          ? typedInstallation
          : UsdPricing.price(typedInstallation, rate),
      // Editing keeps a running offer; one that has ended is cleared.
      offerPrice: !keepsOffer
          ? null
          : offerUsd != null
              ? UsdPricing.offer(offerUsd, rate!)
              : existing.offerPrice,
      offerEndsAt: existing?.offerEndsAt,
      offerBadge: existing?.offerBadge,
      priceUsd: rate == null ? null : typedPrice,
      offerPriceUsd: offerUsd,
      installationPriceUsd: rate == null ? null : typedInstallation,
      usdRateApplied: rate,
    );

    final error = existing == null
        ? await actions.createProduct(product)
        : await actions.updateProduct(product);
    if (!mounted) {
      return;
    }
    setState(() => _isSaving = false);

    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error);
      return;
    }
    showAppSnackBar(
      context,
      existing == null
          ? context.l10n.formProductAdded
          : context.l10n.formProductUpdated,
      tone: AppTone.success,
    );
    // The saved product, for a caller that goes on with it (a new offer).
    Navigator.of(context).pop(product);
  }

  @override
  Widget build(BuildContext context) {
    // The product tree, as Platform Admin has it right now: nothing about it
    // is stored in the app, so new and moved categories appear straight away.
    final categoriesLoaded = ref.watch(allCategoriesProvider).hasValue;
    // Watched so the pounds under the dollar fields follow a new rate.
    final usdRate =
        ref.watch(companyStreamProvider(widget.companyId)).asData?.value?.usdRate;
    final categoryTree = ref.watch(categoryTreeProvider);

    Widget sectionTitle(String title) => Padding(
      padding: const EdgeInsets.only(
        top: AppSpacing.s20,
        bottom: AppSpacing.s8,
      ),
      child: Text(title, style: AppTextStyles.h3),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.isEditing
              ? context.l10n.adminEditProduct
              : context.l10n.adminAddProduct,
        ),
      ),
      body: SafeArea(
        top: false,
        child: Form(
          key: _formKey,
          child: AppCenteredList(
            topPadding: AppSpacing.s8,
            bottomPadding:
                MediaQuery.viewInsetsOf(context).bottom + AppSpacing.s24,
            children: [
              sectionTitle(context.l10n.adminProduct),
              AppTextField(
                label: context.l10n.formProductName,
                controller: _nameController,
                enabled: !_isSaving,
                textCapitalization: TextCapitalization.words,
                prefixIcon: Icons.inventory_2_outlined,
                validator: (value) => (value?.trim().isEmpty ?? true)
                    ? context.l10n.formProductNameRequired
                    : null,
              ),
              const SizedBox(height: AppSpacing.s16),
              AppTextField(
                label: context.l10n.formBrandLabel,
                hint: context.l10n.formBrandHint,
                optional: true,
                controller: _brandController,
                enabled: !_isSaving,
                maxLength: 60,
                textCapitalization: TextCapitalization.words,
                prefixIcon: Icons.sell_outlined,
                onChanged: (_) => setState(() {}),
              ),
              _BrandSuggestions(
                typed: _brandController.text,
                enabled: !_isSaving,
                onPick: (brand) =>
                    setState(() => _brandController.text = brand),
              ),
              const SizedBox(height: AppSpacing.s16),
              ImagePickerField(
                controller: _imageController,
                enabled: !_isSaving,
              ),
              const SizedBox(height: AppSpacing.s16),
              CategoryPickerField(
                tree: categoryTree,
                value: _categoryId,
                label: context.l10n.formCategoryLabel,
                enabled: !_isSaving && categoriesLoaded,
                allowNone: false,
                onChanged: (value) => setState(() => _categoryId = value),
                validator: (value) =>
                    value == null ? context.l10n.formCategoryRequired : null,
              ),
              const SizedBox(height: AppSpacing.s16),
              Text(
                context.l10n.formPriceCurrency,
                style: AppTextStyles.bodyStrong,
              ),
              const SizedBox(height: AppSpacing.s8),
              SegmentedButton<bool>(
                key: const ValueKey('price-currency'),
                segments: [
                  ButtonSegment(
                    value: false,
                    label: Text(context.l10n.formPriceInSdg),
                  ),
                  ButtonSegment(
                    value: true,
                    icon: const Icon(Icons.attach_money_rounded),
                    label: Text(context.l10n.formPriceInUsd),
                  ),
                ],
                selected: {_inUsd},
                showSelectedIcon: false,
                onSelectionChanged: _isSaving
                    ? null
                    : (value) => setState(() => _inUsd = value.first),
              ),
              if (_inUsd && usdRate == null) ...[
                const SizedBox(height: AppSpacing.s12),
                AppBanner(
                  key: const ValueKey('price-needs-rate'),
                  tone: AppTone.warning,
                  message: context.l10n.formUsdNeedsRate,
                  action: AppButton.text(
                    label: context.l10n.usdRateSet,
                    size: AppButtonSize.small,
                    onPressed: _setUsdRate,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.s12),
              AppTextField(
                key: const ValueKey('price-field'),
                label: _inUsd
                    ? context.l10n.formPriceUsd
                    : context.l10n.formPriceOptional,
                controller: _priceController,
                enabled: !_isSaving,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [_decimalFormatter],
                prefixIcon: _inUsd
                    ? Icons.attach_money_rounded
                    : Icons.payments_outlined,
                helperText: _poundsHelper(_priceController.text),
                onChanged: (_) => setState(() {}),
                validator: _validateOptionalPrice,
              ),
              sectionTitle(context.l10n.formStockSection),
              AppTextField(
                label: context.l10n.formStockQuantity,
                controller: _stockController,
                enabled: !_isSaving,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                prefixIcon: Icons.warehouse_outlined,
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
                subtitle: Text(context.l10n.formAvailableHint),
              ),
              sectionTitle(context.l10n.productDescription),
              AppTextField(
                label: context.l10n.productDescription,
                optional: true,
                controller: _descriptionController,
                enabled: !_isSaving,
                minLines: 3,
                maxLines: 6,
              ),
              sectionTitle(context.l10n.productSpecifications),
              for (int i = 0; i < _specRows.length; i++) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 2,
                      child: AppTextField(
                        label: context.l10n.formSpecName,
                        controller: _specRows[i].keyController,
                        enabled: !_isSaving,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.s8),
                    Expanded(
                      flex: 3,
                      child: AppTextField(
                        label: context.l10n.formSpecValue,
                        controller: _specRows[i].valueController,
                        enabled: !_isSaving,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.s24),
                      child: IconButton(
                        tooltip: context.l10n.commonRemove,
                        onPressed: _isSaving ? null : () => _removeSpecRow(i),
                        icon: Icon(
                          Icons.remove_circle_outline,
                          color: context.colors.errorText,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.s12),
              ],
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: AppButton.text(
                  onPressed: _isSaving ? null : _addSpecRow,
                  icon: Icons.add,
                  label: context.l10n.formAddSpec,
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
                    : (value) => setState(() => _installationAvailable = value),
                title: Text(context.l10n.formInstallationAvailable),
                subtitle: Text(
                  _installationAvailable
                      ? context.l10n.formInstallationOn
                      : context.l10n.formInstallationOff,
                ),
              ),
              if (_installationAvailable) ...[
                const SizedBox(height: 8),
                AppTextField(
                  label: _inUsd
                      ? context.l10n.formInstallationPriceUsd
                      : context.l10n.formInstallationPrice,
                  controller: _installationPriceController,
                  enabled: !_isSaving,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [_decimalFormatter],
                  prefixIcon: Icons.handyman_outlined,
                  helperText: _poundsHelper(_installationPriceController.text),
                  onChanged: (_) => setState(() {}),
                  validator: (value) => _validatePositiveNumber(
                    value,
                    requiredMessage: context.l10n.formInstallationPriceRequired,
                    invalidMessage: context.l10n.formInstallationPriceInvalid,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.s24),
              AppButton.primary(
                expand: true,
                loading: _isSaving,
                label: widget.isEditing
                    ? context.l10n.commonSaveChanges
                    : context.l10n.adminAddProduct,
                onPressed: _save,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The brands already used on the marketplace, offered as chips under the
/// brand field so the same make is always spelled the same way.
class _BrandSuggestions extends ConsumerWidget {
  const _BrandSuggestions({
    required this.typed,
    required this.enabled,
    required this.onPick,
  });

  final String typed;
  final bool enabled;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final needle = typed.trim().toLowerCase();
    final suggestions = [
      for (final brand in brandsOf(ref.watch(marketplaceProductsProvider)))
        if (brand.toLowerCase() != needle &&
            (needle.isEmpty || brand.toLowerCase().contains(needle)))
          brand,
    ].take(8).toList();
    if (suggestions.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.s4),
      child: Wrap(
        spacing: AppSpacing.s8,
        runSpacing: AppSpacing.s4,
        children: [
          for (final brand in suggestions)
            ActionChip(
              key: ValueKey('brand-suggestion-$brand'),
              label: Text(brand),
              onPressed: enabled ? () => onPick(brand) : null,
            ),
        ],
      ),
    );
  }
}
