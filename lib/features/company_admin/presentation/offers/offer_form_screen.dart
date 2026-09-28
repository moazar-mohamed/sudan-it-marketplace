import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../company_services/domain/entities/company_service.dart';
import '../../../company_services/presentation/company_service_providers.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../services/domain/entities/catalog_service.dart';
import '../../../services/presentation/service_providers.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../offers/domain/offer_item.dart';
import '../../../offers/domain/offer_pricing.dart';
import '../../../offers/presentation/offer_card.dart';
import '../../../offers/presentation/offer_price.dart';
import '../company_admin_actions.dart';
import '../company_admin_format.dart';
import '../products/product_form_screen.dart';
import '../services/my_services_view.dart';

enum _Kind { product, service }

enum _Mode { percent, price }

enum _Duration { days3, week, month, none, custom }

/// Creates, changes or ends an offer on one of the company's products or
/// services. The customer's view of the offer sits above the publish button
/// and follows every change. The normal price is never touched: the customer pays the
/// offer price until its end date or until the company ends it.
class OfferFormScreen extends ConsumerStatefulWidget {
  const OfferFormScreen({super.key, required this.companyId, this.initial});

  final String companyId;

  /// The product or service to start from; its offer is loaded for editing.
  final OfferItem? initial;

  @override
  ConsumerState<OfferFormScreen> createState() => _OfferFormScreenState();
}

class _OfferFormScreenState extends ConsumerState<OfferFormScreen> {
  final _valueController = TextEditingController();
  late _Kind _kind;
  OfferItem? _selected;
  _Mode _mode = _Mode.percent;
  _Duration _duration = _Duration.week;
  DateTime? _customEnd;
  OfferBadge _badge = OfferBadge.discount;
  bool _saving = false;
  bool _submitted = false;

  static final _decimalFormatter =
      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'));

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    _kind = initial is ServiceOfferItem ? _Kind.service : _Kind.product;
    if (initial != null) _select(initial, rebuild: false);
    _valueController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _valueController.dispose();
    super.dispose();
  }

  /// Picks [item] and loads its offer, if it has one, for editing.
  void _select(OfferItem item, {bool rebuild = true}) {
    void apply() {
      _selected = item;
      _kind = item is ServiceOfferItem ? _Kind.service : _Kind.product;
      final pricing = item.pricing;
      if (pricing.hasOffer) {
        _mode = _Mode.price;
        final offer = pricing.offerPrice!;
        _valueController.text = offer == offer.roundToDouble()
            ? offer.toStringAsFixed(0)
            : offer.toString();
        final ends = pricing.offerEndsAt;
        _duration = ends == null ? _Duration.none : _Duration.custom;
        _customEnd = ends;
        _badge = pricing.offerBadge ?? OfferBadge.discount;
      }
    }

    rebuild ? setState(apply) : apply();
  }

  /// The chosen item as it stands now (prices may change while editing).
  OfferItem? get _live {
    final selected = _selected;
    switch (selected) {
      case null:
        return null;
      case ProductOfferItem(:final product):
        final products = ref
            .watch(companyProductsStreamProvider(widget.companyId))
            .asData
            ?.value;
        for (final item in products ?? const <Product>[]) {
          if (item.id == product.id) return ProductOfferItem(item);
        }
        return selected;
      case ServiceOfferItem(:final link, :final service, :final companyName):
        final links = ref
            .watch(activeServicesForCompanyProvider(widget.companyId))
            .asData
            ?.value;
        for (final item in links ?? const <CompanyService>[]) {
          if (item.id == link.id) {
            return ServiceOfferItem(
              link: item,
              service: service,
              companyName: companyName,
            );
          }
        }
        return selected;
    }
  }

  /// The offer price from what is typed, or null while it is not valid.
  double? _offerPrice(double? normal) {
    final value = double.tryParse(_valueController.text.trim());
    if (normal == null || value == null) return null;
    final price = _mode == _Mode.percent
        ? (value >= 1 && value <= 99
            ? (normal * (1 - value / 100)).roundToDouble()
            : null)
        : value;
    return price != null && price > 0 && price < normal ? price : null;
  }

  String? _valueError(double? normal) {
    if (_offerPrice(normal) != null) return null;
    final l10n = context.l10n;
    return _mode == _Mode.percent
        ? l10n.offerPercentInvalid
        : l10n.offerPriceTooHigh;
  }

  /// When the offer ends, from the chosen duration.
  DateTime? get _endsAt {
    final now = DateTime.now();
    return switch (_duration) {
      _Duration.days3 => now.add(const Duration(days: 3)),
      _Duration.week => now.add(const Duration(days: 7)),
      _Duration.month => now.add(const Duration(days: 30)),
      _Duration.none => null,
      _Duration.custom => _customEnd,
    };
  }

  bool get _endIsPast {
    final ends = _endsAt;
    return ends != null && !ends.isAfter(DateTime.now());
  }

  /// [item] with the offer being entered, for the preview and for saving.
  OfferItem _withOffer(OfferItem item, double? offerPrice) => switch (item) {
        ProductOfferItem(:final product) => ProductOfferItem(
            product.withOffer(offerPrice, _endsAt, _badge),
          ),
        ServiceOfferItem(:final link, :final service, :final companyName) =>
          ServiceOfferItem(
            link: link.withOffer(offerPrice, _endsAt, _badge),
            service: service,
            companyName: companyName,
          ),
      };

  Future<void> _pickEndDate() async {
    final today = DateUtils.dateOnly(DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: _customEnd != null && _customEnd!.isAfter(today)
          ? _customEnd!
          : today.add(const Duration(days: 7)),
      firstDate: today,
      lastDate: today.add(const Duration(days: 365)),
    );
    if (picked == null) return;
    setState(() {
      _duration = _Duration.custom;
      // The offer runs through the whole of its last day.
      _customEnd = DateTime(picked.year, picked.month, picked.day, 23, 59, 59);
    });
  }

  Future<void> _choose() async {
    final item = await showModalBottomSheet<OfferItem>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => _OfferItemPicker(
        companyId: widget.companyId,
        services: _kind == _Kind.service,
      ),
    );
    if (item != null && mounted) _select(item);
  }

  /// Adds a product or service and goes on with it as the offer's item.
  Future<void> _createNew() async {
    if (_kind == _Kind.product) {
      final product = await Navigator.of(context).push<Product>(
        MaterialPageRoute(
          builder: (_) => ProductFormScreen.add(companyId: widget.companyId),
        ),
      );
      if (product != null && mounted) _select(ProductOfferItem(product));
      return;
    }
    final provider = activeServicesForCompanyProvider(widget.companyId);
    final before = {
      for (final link in ref.read(provider).asData?.value ?? const [])
        link.id,
    };
    await showCreateOwnService(context, ref, widget.companyId);
    // The new service arrives through the live list shortly after saving.
    for (var i = 0; i < 20 && mounted; i++) {
      final links = ref.read(provider).asData?.value ?? const [];
      final added = links.where((link) => !before.contains(link.id));
      if (added.isNotEmpty) {
        final link = added.first;
        final service = ref
            .read(allServicesProvider(null))
            .asData
            ?.value
            .where((s) => s.id == link.serviceId)
            .firstOrNull;
        if (service != null) {
          _select(ServiceOfferItem(
            link: link,
            service: service,
            companyName: _companyName,
          ));
          return;
        }
      }
      await Future<void>.delayed(const Duration(milliseconds: 150));
    }
  }

  String get _companyName =>
      ref.read(companyStreamProvider(widget.companyId)).asData?.value?.name ??
      '';

  Future<void> _save(OfferItem item, {required bool end}) async {
    if (_saving) return;
    FocusScope.of(context).unfocus();
    final offerPrice = end ? null : _offerPrice(item.pricing.price);
    if (!end) {
      setState(() => _submitted = true);
      if (offerPrice == null || _endIsPast) return;
    } else {
      final ok = await showConfirmationDialog(
        context,
        title: context.l10n.offerEndConfirmTitle,
        body: context.l10n.offerEndConfirmBody(item.name),
        confirmLabel: context.l10n.offerRemove,
        destructive: true,
      );
      if (!ok || !mounted) return;
    }
    setState(() => _saving = true);
    final actions = ref.read(companyAdminActionsProvider);
    final error = switch (_withOffer(item, offerPrice)) {
      ProductOfferItem(:final product) => await actions.updateProduct(product),
      ServiceOfferItem(:final link) => await actions.setServiceOffer(
          companyServiceId: link.id,
          offerPrice: link.offerPrice,
          offerEndsAt: link.offerEndsAt,
          offerBadge: link.offerBadge,
        ),
    };
    if (!mounted) return;
    setState(() => _saving = false);
    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error);
      return;
    }
    final l10n = context.l10n;
    showAppSnackBar(
      context,
      end
          ? l10n.offerRemoved
          : item.pricing.hasOffer
              ? l10n.offerSaved
              : l10n.offerPublished,
      tone: AppTone.success,
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final item = _live;
    final normal = item?.pricing.price;
    final offerPrice = _offerPrice(normal);
    final editing = item?.pricing.hasOffer ?? false;
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    Widget label(String text) => Padding(
          padding: const EdgeInsets.only(
            top: AppSpacing.s20,
            bottom: AppSpacing.s8,
          ),
          child: Text(text, style: AppTextStyles.h3),
        );

    return Scaffold(
      appBar: AppBar(
        title: Text(editing ? l10n.offerEdit : l10n.offerNewTitle),
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s32),
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.s8),
            child: Text(l10n.offerOnLabel, style: AppTextStyles.h3),
          ),
          SegmentedButton<_Kind>(
            key: const ValueKey('offer-kind'),
            segments: [
              ButtonSegment(
                value: _Kind.product,
                icon: const Icon(Icons.inventory_2_outlined),
                label: Text(l10n.offerKindProduct),
              ),
              ButtonSegment(
                value: _Kind.service,
                icon: const Icon(Icons.design_services_outlined),
                label: Text(l10n.offerKindService),
              ),
            ],
            selected: {_kind},
            // An existing offer stays on its own item.
            onSelectionChanged: editing || _saving
                ? null
                : (value) => setState(() {
                      _kind = value.first;
                      _selected = null;
                      _submitted = false;
                    }),
          ),
          const SizedBox(height: AppSpacing.s12),
          if (item == null)
            AppButton.outlined(
              key: const ValueKey('offer-choose'),
              expand: true,
              icon: Icons.search_rounded,
              label: l10n.offerChooseItem,
              onPressed: _saving ? null : _choose,
            )
          else
            _SelectedItemTile(
              item: item,
              onChange: editing || _saving ? null : _choose,
            ),
          if (_submitted && item == null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.s4),
              child: Text(
                l10n.offerPickItemRequired,
                style: AppTextStyles.caption.copyWith(color: colors.errorText),
              ),
            ),
          if (!editing) ...[
            const SizedBox(height: AppSpacing.s8),
            AppButton.text(
              key: const ValueKey('offer-create-new'),
              icon: Icons.add_rounded,
              label: _kind == _Kind.product
                  ? l10n.offerNewProduct
                  : l10n.offerNewService,
              onPressed: _saving ? null : _createNew,
            ),
          ],
          label(l10n.offerDiscountMethod),
          SegmentedButton<_Mode>(
            key: const ValueKey('offer-mode'),
            segments: [
              ButtonSegment(
                value: _Mode.percent,
                icon: const Icon(Icons.percent_rounded),
                label: Text(l10n.offerModePercent),
              ),
              ButtonSegment(
                value: _Mode.price,
                icon: const Icon(Icons.payments_outlined),
                label: Text(l10n.offerModePrice),
              ),
            ],
            selected: {_mode},
            onSelectionChanged: _saving
                ? null
                : (value) {
                    // Carry the same discount over to the other way of
                    // entering it.
                    final price = offerPrice;
                    setState(() {
                      _mode = value.first;
                      if (price != null && normal != null) {
                        _valueController.text = _mode == _Mode.percent
                            ? ((1 - price / normal) * 100).round().toString()
                            : price.toStringAsFixed(0);
                      }
                    });
                  },
          ),
          const SizedBox(height: AppSpacing.s12),
          AppTextField(
            key: const ValueKey('offer-value'),
            label: _mode == _Mode.percent
                ? l10n.offerPercentLabel
                : '${l10n.offerModePrice} (SDG)',
            controller: _valueController,
            enabled: !_saving,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [_decimalFormatter],
            prefixIcon: _mode == _Mode.percent
                ? Icons.percent_rounded
                : Icons.local_offer_outlined,
            helperText: offerPrice == null || normal == null
                ? null
                : _mode == _Mode.percent
                    ? l10n.offerComputedPrice(
                        formatProductPrice(offerPrice),
                        item!.currency,
                      )
                    : l10n.offerDiscountBadge(
                        ((1 - offerPrice / normal) * 100).round(),
                      ),
          ),
          if (_submitted && item != null && offerPrice == null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.s4),
              child: Text(
                _valueError(normal)!,
                style: AppTextStyles.caption.copyWith(color: colors.errorText),
              ),
            ),
          label(l10n.offerDuration),
          _ChoiceWrap(
            keyPrefix: 'offer-duration',
            labels: [
              l10n.offerDuration3Days,
              l10n.offerDurationWeek,
              l10n.offerDurationMonth,
              l10n.offerDurationNone,
              _duration == _Duration.custom && _customEnd != null
                  ? MaterialLocalizations.of(context)
                      .formatMediumDate(_customEnd!)
                  : l10n.offerDurationCustom,
            ],
            selectedIndex: _duration.index,
            onChanged: _saving
                ? null
                : (index) {
                    final choice = _Duration.values[index];
                    if (choice == _Duration.custom) {
                      _pickEndDate();
                    } else {
                      setState(() => _duration = choice);
                    }
                  },
          ),
          const SizedBox(height: AppSpacing.s4),
          Text(
            _submitted && _endIsPast ? l10n.offerEndDatePast : l10n.offerEndsHint,
            style: AppTextStyles.caption.copyWith(
              color: _submitted && _endIsPast
                  ? colors.errorText
                  : colors.textTertiary,
            ),
          ),
          label(l10n.offerBadgeLabel),
          _ChoiceWrap(
            keyPrefix: 'offer-badge',
            labels: [
              l10n.offerBadgeDiscount,
              l10n.offerBadgeSpecial,
              l10n.offerBadgeLimited,
            ],
            selectedIndex: _badge.index,
            onChanged: _saving
                ? null
                : (index) => setState(() => _badge = OfferBadge.values[index]),
          ),
          const SizedBox(height: AppSpacing.s24),
          // Last, just above publishing: the offer as customers will see it.
          _PreviewPanel(
            item: item == null ? null : _withOffer(item, offerPrice),
            endsAt: offerPrice == null ? null : _endsAt,
          ),
          const SizedBox(height: AppSpacing.s16),
          AppButton.primary(
            key: const ValueKey('offer-save'),
            expand: true,
            loading: _saving,
            icon: editing ? null : Icons.campaign_outlined,
            label: editing ? l10n.commonSaveChanges : l10n.offerPublish,
            onPressed: item == null
                ? () => setState(() => _submitted = true)
                : () => _save(item, end: false),
          ),
          if (editing) ...[
            const SizedBox(height: AppSpacing.s8),
            AppButton.destructiveOutlined(
              key: const ValueKey('offer-remove'),
              expand: true,
              label: l10n.offerRemove,
              onPressed: _saving ? null : () => _save(item!, end: true),
            ),
          ],
        ],
      ),
    );
  }
}

/// The offer as customers will see it, with what it saves and when it ends.
class _PreviewPanel extends StatelessWidget {
  const _PreviewPanel({required this.item, required this.endsAt});

  final OfferItem? item;
  final DateTime? endsAt;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final item = this.item;
    return Container(
      key: const ValueKey('offer-preview'),
      padding: const EdgeInsets.all(AppSpacing.s12),
      decoration: BoxDecoration(
        color: colors.bgSubtle,
        borderRadius: AppRadius.mdAll,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.visibility_outlined,
                  size: AppSize.iconSm, color: colors.textSecondary),
              const SizedBox(width: AppSpacing.s4),
              Expanded(
                child: Text(
                  l10n.homeFeaturedOffers,
                  style: AppTextStyles.captionStrong
                      .copyWith(color: colors.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s8),
          if (item == null)
            SizedBox(
              height: 120,
              child: Center(
                child: Text(
                  l10n.offerPreviewEmpty,
                  textAlign: TextAlign.center,
                  style: AppTextStyles.body
                      .copyWith(color: colors.textSecondary),
                ),
              ),
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                OfferCard(item: item),
                const SizedBox(width: AppSpacing.s12),
                Expanded(child: _PreviewFacts(item: item, endsAt: endsAt)),
              ],
            ),
        ],
      ),
    );
  }
}

class _PreviewFacts extends StatelessWidget {
  const _PreviewFacts({required this.item, required this.endsAt});

  final OfferItem item;
  final DateTime? endsAt;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final pricing = item.pricing;
    final style = AppTextStyles.caption.copyWith(color: colors.textSecondary);
    Widget fact(IconData icon, String text) => Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.s8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: AppSize.iconSm, color: colors.iconMuted),
              const SizedBox(width: AppSpacing.s4),
              Expanded(child: Text(text, style: style)),
            ],
          ),
        );
    final normal = pricing.price;
    if (normal == null) {
      return fact(Icons.info_outline, l10n.offerNeedsPrice);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        fact(
          Icons.sell_outlined,
          l10n.offerNormalPrice(formatProductPrice(normal), item.currency),
        ),
        if (pricing.hasOffer) ...[
          fact(
            Icons.savings_outlined,
            l10n.offerSaves(
              formatProductPrice(normal - pricing.offerPrice!),
              item.currency,
            ),
          ),
          fact(
            Icons.schedule_rounded,
            endsAt == null
                ? l10n.offerNoEndDate
                : l10n.offerEndsOn(
                    MaterialLocalizations.of(context).formatMediumDate(endsAt!),
                  ),
          ),
        ],
      ],
    );
  }
}

class _SelectedItemTile extends StatelessWidget {
  const _SelectedItemTile({required this.item, required this.onChange});

  final OfferItem item;
  final VoidCallback? onChange;

  @override
  Widget build(BuildContext context) {
    final normal = item.pricing.price;
    return AppListCard(
      key: const ValueKey('offer-selected'),
      onTap: onChange,
      showChevron: false,
      leading: AppImageTile(
        imageUrl: item.imageUrl,
        fallbackIcon: item is ServiceOfferItem
            ? Icons.design_services_outlined
            : Icons.inventory_2_outlined,
      ),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodyStrong,
          ),
          Text(
            normal == null
                ? context.l10n.offerItemNoPrice
                : context.l10n.offerNormalPrice(
                    formatProductPrice(normal),
                    item.currency,
                  ),
            style: AppTextStyles.caption
                .copyWith(color: context.colors.textSecondary),
          ),
        ],
      ),
      trailing: onChange == null
          ? null
          : Text(
              context.l10n.offerChange,
              style: AppTextStyles.captionStrong
                  .copyWith(color: context.colors.textBrand),
            ),
    );
  }
}

/// One-choice chips that wrap onto more lines instead of scrolling.
class _ChoiceWrap extends StatelessWidget {
  const _ChoiceWrap({
    required this.keyPrefix,
    required this.labels,
    required this.selectedIndex,
    required this.onChanged,
  });

  final String keyPrefix;
  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Wrap(
      spacing: AppSpacing.s8,
      runSpacing: AppSpacing.s8,
      children: [
        for (var i = 0; i < labels.length; i++)
          ChoiceChip(
            key: ValueKey('$keyPrefix-$i'),
            label: Text(labels[i]),
            selected: i == selectedIndex,
            onSelected: onChanged == null ? null : (_) => onChanged!(i),
            side: BorderSide(
              color: i == selectedIndex
                  ? colors.borderFocus
                  : colors.borderInput,
            ),
            labelStyle: AppTextStyles.labelLarge.copyWith(
              color: i == selectedIndex
                  ? colors.textBrand
                  : colors.textPrimary,
            ),
          ),
      ],
    );
  }
}

/// Picks one of the company's products or services, with a search box.
/// Items without a price are shown but cannot be picked.
class _OfferItemPicker extends ConsumerStatefulWidget {
  const _OfferItemPicker({required this.companyId, required this.services});

  final String companyId;
  final bool services;

  @override
  ConsumerState<_OfferItemPicker> createState() => _OfferItemPickerState();
}

class _OfferItemPickerState extends ConsumerState<_OfferItemPicker> {
  String _query = '';

  List<OfferItem>? _items() {
    if (!widget.services) {
      final products = ref
          .watch(companyProductsStreamProvider(widget.companyId))
          .asData
          ?.value;
      return products?.map(ProductOfferItem.new).toList();
    }
    final links = ref
        .watch(activeServicesForCompanyProvider(widget.companyId))
        .asData
        ?.value;
    final services = ref.watch(allServicesProvider(null)).asData?.value ??
        const <CatalogService>[];
    if (links == null) return null;
    final byId = {for (final service in services) service.id: service};
    final companyName = ref
            .watch(companyStreamProvider(widget.companyId))
            .asData
            ?.value
            ?.name ??
        '';
    return [
      for (final link in links)
        if (byId[link.serviceId] case final service?)
          ServiceOfferItem(
            link: link,
            service: service,
            companyName: companyName,
          ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final all = _items();
    final query = _query.trim().toLowerCase();
    final items = [
      for (final item in all ?? const <OfferItem>[])
        if (query.isEmpty || item.name.toLowerCase().contains(query)) item,
    ];
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.8,
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.s16,
            0,
            AppSpacing.s16,
            AppSpacing.s16 + MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.services
                    ? l10n.offerPickServiceTitle
                    : l10n.offerPickProductTitle,
                style: AppTextStyles.h2,
              ),
              const SizedBox(height: AppSpacing.s12),
              AppTextField(
                key: const ValueKey('offer-pick-search'),
                hint: l10n.offerSearchHint,
                prefixIcon: Icons.search_rounded,
                onChanged: (value) => setState(() => _query = value),
              ),
              const SizedBox(height: AppSpacing.s12),
              if (all == null)
                const AppLoadingState()
              else if (all.isEmpty)
                AppEmptyState(
                  icon: widget.services
                      ? Icons.design_services_outlined
                      : Icons.inventory_2_outlined,
                  message: widget.services
                      ? l10n.offerPickServiceEmpty
                      : l10n.offerPickProductEmpty,
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: items.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.s8),
                    itemBuilder: (context, index) {
                      final item = items[index];
                      final priced = item.pricing.price != null;
                      return Opacity(
                        opacity: priced ? 1 : 0.55,
                        child: AppListCard(
                          key: ValueKey('offer-pick-${item.id}'),
                          onTap: priced
                              ? () => Navigator.of(context).pop(item)
                              : null,
                          showChevron: priced,
                          leading: AppImageTile(
                            imageUrl: item.imageUrl,
                            fallbackIcon: widget.services
                                ? Icons.design_services_outlined
                                : Icons.inventory_2_outlined,
                          ),
                          content: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.bodyStrong,
                              ),
                              const SizedBox(height: AppSpacing.s4),
                              if (priced)
                                OfferPriceText(
                                  pricing: item.pricing,
                                  currency: item.currency,
                                  style: AppTextStyles.body,
                                )
                              else
                                Text(
                                  l10n.offerItemNoPrice,
                                  style: AppTextStyles.caption.copyWith(
                                    color: context.colors.textSecondary,
                                  ),
                                ),
                            ],
                          ),
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
                child: Text(l10n.catalogOffers, style: AppTextStyles.h3),
              ),
              OfferBadgeChip(pricing: product),
            ],
          ),
          const SizedBox(height: AppSpacing.s8),
          if (running) ...[
            Text(
              CompanyAdminFormat.price(product.offerPrice!, product.currency),
              style: AppTextStyles.bodyStrong.copyWith(color: colors.textBrand),
            ),
            Text(
              product.offerEndsAt == null
                  ? l10n.offerNoEndDate
                  : l10n.offerEndsOn(
                      MaterialLocalizations.of(context)
                          .formatMediumDate(product.offerEndsAt!),
                    ),
              style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
            ),
          ] else if (!product.hasPrice)
            Text(
              l10n.offerNeedsPrice,
              style: AppTextStyles.body.copyWith(color: colors.textSecondary),
            ),
          if (product.hasPrice) ...[
            const SizedBox(height: AppSpacing.s12),
            AppButton.outlined(
              key: const ValueKey('product-offer-manage'),
              size: AppButtonSize.medium,
              icon: running ? Icons.edit_outlined : Icons.add_rounded,
              label: running ? l10n.offerEdit : l10n.offerAddCta,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => OfferFormScreen(
                    companyId: product.companyId ?? '',
                    initial: ProductOfferItem(product),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
