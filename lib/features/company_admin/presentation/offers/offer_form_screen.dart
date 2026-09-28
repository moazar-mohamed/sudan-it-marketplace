import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../products/presentation/widgets/product_offer_price.dart';
import '../company_admin_actions.dart';
import '../company_admin_format.dart';

/// The Add sheet's "Add offer": pick one of the company's priced products,
/// then set its offer.
Future<void> showAddOfferFlow(
  BuildContext context,
  WidgetRef ref,
  String companyId,
) async {
  final product = await showModalBottomSheet<Product>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => _OfferProductPicker(companyId: companyId),
  );
  if (product == null || !context.mounted) return;
  await Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => OfferFormScreen(product: product)),
  );
}

class _OfferProductPicker extends ConsumerWidget {
  const _OfferProductPicker({required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(companyProductsStreamProvider(companyId));
    // Only a priced product can have an offer below its price.
    final products = [
      for (final product in productsAsync.asData?.value ?? const <Product>[])
        if (product.hasPrice) product,
    ];
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.75,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.s16,
            0,
            AppSpacing.s16,
            AppSpacing.s16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(context.l10n.offerPickProductTitle, style: AppTextStyles.h2),
              const SizedBox(height: AppSpacing.s12),
              if (productsAsync.isLoading && products.isEmpty)
                const AppLoadingState()
              else if (products.isEmpty)
                AppEmptyState(
                  icon: Icons.inventory_2_outlined,
                  message: context.l10n.offerPickProductEmpty,
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: products.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.s8),
                    itemBuilder: (context, index) {
                      final product = products[index];
                      return AppListCard(
                        key: ValueKey('offer-pick-${product.id}'),
                        onTap: () => Navigator.of(context).pop(product),
                        leading: AppImageTile(imageUrl: product.imageUrl),
                        content: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              product.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.bodyStrong,
                            ),
                            const SizedBox(height: AppSpacing.s4),
                            ProductOfferPrice(
                              product: product,
                              style: AppTextStyles.body,
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Sets, changes or ends the offer on one priced product. The normal price
/// is never touched: the customer pays the offer price until the end date or
/// until the company ends the offer.
class OfferFormScreen extends ConsumerStatefulWidget {
  const OfferFormScreen({super.key, required this.product});

  final Product product;

  @override
  ConsumerState<OfferFormScreen> createState() => _OfferFormScreenState();
}

class _OfferFormScreenState extends ConsumerState<OfferFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _priceController;
  DateTime? _endsOn;
  bool _isSaving = false;

  static final _decimalFormatter =
      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'));

  /// The product as it stands now (the picker's copy may be stale).
  Product get _live {
    final products = ref
        .watch(companyProductsStreamProvider(widget.product.companyId ?? ''))
        .asData
        ?.value;
    for (final product in products ?? const <Product>[]) {
      if (product.id == widget.product.id) return product;
    }
    return widget.product;
  }

  @override
  void initState() {
    super.initState();
    final product = widget.product;
    final running = product.hasActiveOffer;
    final offer = product.offerPrice;
    _priceController = TextEditingController(
      text: running && offer != null
          ? (offer == offer.roundToDouble()
              ? offer.toStringAsFixed(0)
              : offer.toString())
          : '',
    );
    _endsOn = running ? product.offerEndsAt : null;
    _priceController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _priceController.dispose();
    super.dispose();
  }

  double? get _enteredPrice => double.tryParse(_priceController.text.trim());

  String? _validate(String? value, double normalPrice) {
    final price = double.tryParse(value?.trim() ?? '');
    if (price == null || price <= 0) return context.l10n.offerPriceRequired;
    if (price >= normalPrice) return context.l10n.offerPriceTooHigh;
    return null;
  }

  Future<void> _pickEndDate() async {
    final today = DateUtils.dateOnly(DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: _endsOn ?? today.add(const Duration(days: 7)),
      firstDate: today,
      lastDate: today.add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _endsOn = _endOfDay(picked));
  }

  /// The offer runs through the whole of its last day.
  static DateTime _endOfDay(DateTime day) =>
      DateTime(day.year, day.month, day.day, 23, 59, 59);

  Future<void> _save(Product product, {required bool remove}) async {
    if (_isSaving) return;
    FocusScope.of(context).unfocus();
    if (!remove && !(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _isSaving = true);
    final error = await ref.read(companyAdminActionsProvider).updateProduct(
          remove
              ? product.withOffer(null, null)
              : product.withOffer(_enteredPrice, _endsOn),
        );
    if (!mounted) return;
    setState(() => _isSaving = false);
    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error);
      return;
    }
    showAppSnackBar(
      context,
      remove ? context.l10n.offerRemoved : context.l10n.offerSaved,
      tone: AppTone.success,
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final product = _live;
    final normalPrice = product.price;
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    // The offer as customers would see it with what is typed right now.
    final entered = _enteredPrice;
    final preview = normalPrice != null &&
            entered != null &&
            entered > 0 &&
            entered < normalPrice
        ? product.withOffer(entered, null)
        : null;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.offerFormTitle)),
      body: normalPrice == null
          ? AppEmptyState(
              icon: Icons.payments_outlined,
              message: l10n.offerNeedsPrice,
            )
          : SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                margin,
                AppSpacing.s16,
                margin,
                AppSpacing.s24,
              ),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        AppImageTile(imageUrl: product.imageUrl),
                        const SizedBox(width: AppSpacing.s12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                product.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.bodyStrong,
                              ),
                              const SizedBox(height: AppSpacing.s4),
                              Text(
                                l10n.offerNormalPrice(
                                  formatProductPrice(normalPrice),
                                  product.currency,
                                ),
                                style: AppTextStyles.body
                                    .copyWith(color: colors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.s20),
                    AppTextField(
                      key: const ValueKey('offer-price'),
                      label: l10n.offerPriceLabel,
                      controller: _priceController,
                      enabled: !_isSaving,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [_decimalFormatter],
                      prefixIcon: Icons.local_offer_outlined,
                      validator: (value) => _validate(value, normalPrice),
                    ),
                    const SizedBox(height: AppSpacing.s16),
                    Text(l10n.offerEndsLabel, style: AppTextStyles.captionStrong),
                    const SizedBox(height: AppSpacing.s8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            key: const ValueKey('offer-end-date'),
                            onPressed: _isSaving ? null : _pickEndDate,
                            icon: const Icon(Icons.calendar_today_outlined),
                            label: Text(
                              _endsOn == null
                                  ? l10n.offerNoEndDate
                                  : MaterialLocalizations.of(context)
                                      .formatMediumDate(_endsOn!),
                            ),
                          ),
                        ),
                        if (_endsOn != null) ...[
                          const SizedBox(width: AppSpacing.s8),
                          TextButton(
                            onPressed: _isSaving
                                ? null
                                : () => setState(() => _endsOn = null),
                            child: Text(l10n.offerClearEndDate),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: AppSpacing.s4),
                    Text(
                      l10n.offerEndsHint,
                      style: AppTextStyles.caption
                          .copyWith(color: colors.textTertiary),
                    ),
                    if (preview != null) ...[
                      const SizedBox(height: AppSpacing.s20),
                      Text(
                        l10n.offerPreviewLabel,
                        style: AppTextStyles.captionStrong,
                      ),
                      const SizedBox(height: AppSpacing.s8),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.s12),
                        decoration: BoxDecoration(
                          color: colors.bgSubtle,
                          borderRadius: AppRadius.mdAll,
                        ),
                        child: Row(
                          children: [
                            AppImageTile(imageUrl: product.imageUrl),
                            const SizedBox(width: AppSpacing.s12),
                            Expanded(
                              child: ProductOfferPrice(
                                product: preview,
                                style: AppTextStyles.bodyStrong,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.s24),
                    AppButton.primary(
                      key: const ValueKey('offer-save'),
                      expand: true,
                      loading: _isSaving,
                      label: l10n.offerSave,
                      onPressed: () => _save(product, remove: false),
                    ),
                    if (product.offerPrice != null) ...[
                      const SizedBox(height: AppSpacing.s8),
                      AppButton.outlined(
                        key: const ValueKey('offer-remove'),
                        expand: true,
                        label: l10n.offerRemove,
                        onPressed: _isSaving
                            ? null
                            : () => _save(product, remove: true),
                      ),
                    ],
                  ],
                ),
              ),
            ),
    );
  }
}

/// The offer section of the company's product details: what runs now and a
/// way to add, change or end it.
class ProductOfferSection extends StatelessWidget {
  const ProductOfferSection({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final running = product.hasActiveOffer;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.borderDefault),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.local_fire_department_rounded,
                color: colors.errorText,
                size: AppSize.iconMd,
              ),
              const SizedBox(width: AppSpacing.s8),
              Expanded(
                child: Text(l10n.offerFormTitle, style: AppTextStyles.h3),
              ),
              if (running) OfferDiscountBadge(product: product),
            ],
          ),
          const SizedBox(height: AppSpacing.s8),
          if (running) ...[
            Text(
              CompanyAdminFormat.price(product.offerPrice!, product.currency),
              style: AppTextStyles.bodyStrong.copyWith(color: colors.textBrand),
            ),
            if (product.offerEndsAt != null)
              Text(
                l10n.offerEndsOn(
                  MaterialLocalizations.of(context)
                      .formatMediumDate(product.offerEndsAt!),
                ),
                style: AppTextStyles.caption
                    .copyWith(color: colors.textSecondary),
              ),
          ] else
            Text(
              product.hasPrice ? l10n.offerNone : l10n.offerNeedsPrice,
              style: AppTextStyles.body.copyWith(color: colors.textSecondary),
            ),
          if (product.hasPrice) ...[
            const SizedBox(height: AppSpacing.s12),
            AppButton.outlined(
              key: const ValueKey('product-offer-manage'),
              size: AppButtonSize.medium,
              icon: running ? Icons.edit_outlined : Icons.add_rounded,
              label: running ? l10n.offerEdit : l10n.adminAddOffer,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => OfferFormScreen(product: product),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
