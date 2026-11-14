import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../chats/presentation/chat_providers.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../offers/presentation/offer_price.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/usd_pricing.dart';
import '../../../products/presentation/usd_format.dart';
import '../../../push/domain/push_categories.dart';
import '../../../push/presentation/push_preference.dart';
import '../company_admin_actions.dart';

/// The company's dollar rate: the first card on its Home, and the one place
/// it is set, confirmed ("same rate") or changed. Once the company sells in
/// dollars its colour follows the rate's age: green, then amber after a day,
/// red after two.
///
/// It also finishes a rewrite of the dollar products that was cut short (the
/// connection dropped half way), whenever it sees one.
class UsdRateCard extends ConsumerStatefulWidget {
  const UsdRateCard({
    super.key,
    required this.companyId,
    required this.company,
    required this.products,
  });

  final String companyId;

  /// Null while the company loads.
  final Company? company;

  /// Null while the products load.
  final List<Product>? products;

  @override
  ConsumerState<UsdRateCard> createState() => _UsdRateCardState();
}

class _UsdRateCardState extends ConsumerState<UsdRateCard> {
  bool _confirming = false;

  /// The rate the cut-short rewrite was last finished for, so it runs once.
  double? _repricedFor;

  @override
  void didUpdateWidget(UsdRateCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    _finishRepricing();
  }

  @override
  void initState() {
    super.initState();
    _finishRepricing();
  }

  void _finishRepricing() {
    final rate = widget.company?.usdRate;
    final products = widget.products;
    if (rate == null || products == null || _repricedFor == rate) return;
    if (!products.any((p) => UsdPricing.needsRepricing(p, rate))) return;
    _repricedFor = rate;
    ref.read(companyAdminActionsProvider).repriceStaleProducts(rate, products);
  }

  Future<void> _confirmSame() async {
    final rate = widget.company?.usdRate;
    if (rate == null || _confirming) return;
    setState(() => _confirming = true);
    final error = await ref
        .read(companyAdminActionsProvider)
        .setUsdRate(widget.companyId, rate, widget.products ?? const []);
    if (!mounted) return;
    setState(() => _confirming = false);
    showAppSnackBar(
      context,
      error ?? context.l10n.usdRateConfirmed,
      tone: error == null ? AppTone.success : AppTone.error,
    );
  }

  void _edit() => showUsdRateSheet(
        context,
        companyId: widget.companyId,
        currentRate: widget.company?.usdRate,
        products: widget.products ?? const [],
      );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final company = widget.company;
    if (company == null) return const SizedBox.shrink();
    final rate = company.usdRate;
    final usdCount =
        (widget.products ?? const <Product>[]).where((p) => p.isPricedInUsd).length;

    if (rate == null) {
      return AppCard(
        key: const ValueKey('usd-rate-card'),
        padding: const EdgeInsets.all(AppSpacing.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const AppIconTile(icon: Icons.currency_exchange_rounded, size: 40),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: Text(l10n.usdRateNotSetTitle, style: AppTextStyles.h3),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.s8),
            Text(
              l10n.usdRateNotSetBody,
              style: AppTextStyles.body.copyWith(color: context.colors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.s12),
            AppButton.primary(
              label: l10n.usdRateSet,
              size: AppButtonSize.medium,
              onPressed: _edit,
            ),
          ],
        ),
      );
    }

    final age = UsdPricing.ageOf(company.usdRateUpdatedAt, DateTime.now());
    // A company that does not sell in dollars is never warned.
    final tone = usdCount == 0
        ? AppTone.brand
        : switch (age) {
            UsdRateAge.fresh => AppTone.success,
            UsdRateAge.due => AppTone.warning,
            UsdRateAge.stale => AppTone.error,
          };
    final warning = usdCount == 0
        ? null
        : switch (age) {
            UsdRateAge.fresh => null,
            UsdRateAge.due => l10n.usdRateDue,
            UsdRateAge.stale => l10n.usdRateStale,
          };
    final colors = context.colors;
    return AppCard(
      key: const ValueKey('usd-rate-card'),
      padding: const EdgeInsets.all(AppSpacing.s16),
      color: usdCount == 0 ? null : tone.background(colors),
      borderColor: usdCount == 0 ? null : tone.accent(colors),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              AppIconTile(
                icon: Icons.currency_exchange_rounded,
                tone: tone,
                size: 40,
              ),
              const SizedBox(width: AppSpacing.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.usdRateTitle,
                      style: AppTextStyles.caption
                          .copyWith(color: colors.textSecondary),
                    ),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: AlignmentDirectional.centerStart,
                      child: Text(
                        l10n.usdRateValue(formatUsdAmount(rate)),
                        key: const ValueKey('usd-rate-value'),
                        maxLines: 1,
                        style: AppTextStyles.h1,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s8),
          Text(
            _ageText(context, l10n, company.usdRateUpdatedAt),
            style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
          ),
          Text(
            l10n.usdRateProducts(usdCount),
            style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
          ),
          if (warning != null) ...[
            const SizedBox(height: AppSpacing.s8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  AppBanner.defaultIcon(tone),
                  size: AppSize.iconMd,
                  color: tone.accent(colors),
                ),
                const SizedBox(width: AppSpacing.s8),
                Expanded(
                  child: Text(
                    warning,
                    style: (age == UsdRateAge.stale
                            ? AppTextStyles.bodyLargeStrong
                            : AppTextStyles.bodyStrong)
                        .copyWith(color: tone.foreground(colors)),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.s12),
          Row(
            children: [
              Expanded(
                child: AppButton.secondary(
                  key: const ValueKey('usd-rate-same'),
                  label: l10n.usdRateSame,
                  size: AppButtonSize.medium,
                  loading: _confirming,
                  onPressed: _confirmSame,
                ),
              ),
              const SizedBox(width: AppSpacing.s12),
              Expanded(
                child: AppButton.primary(
                  key: const ValueKey('usd-rate-edit'),
                  label: l10n.usdRateEdit,
                  size: AppButtonSize.medium,
                  onPressed: _confirming ? null : _edit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _ageText(
    BuildContext context,
    AppLocalizations l10n,
    DateTime? updatedAt,
  ) {
    if (updatedAt == null) return l10n.usdRateStale;
    final local = updatedAt.toLocal();
    final time = MaterialLocalizations.of(context)
        .formatTimeOfDay(TimeOfDay.fromDateTime(local));
    final now = DateTime.now();
    final days = DateTime(now.year, now.month, now.day)
        .difference(DateTime(local.year, local.month, local.day))
        .inDays;
    return switch (days) {
      <= 0 => l10n.usdRateUpdatedToday(time),
      1 => l10n.usdRateUpdatedYesterday(time),
      _ => l10n.usdRateUpdatedDaysAgo(days),
    };
  }
}

/// Opens the window that sets or changes the company's dollar rate. It shows
/// what the new rate does to the dollar products before saving, asks first
/// when the rate jumps by more than [UsdPricing.bigChange], and holds the
/// switch for the 24-hour phone reminder.
Future<void> showUsdRateSheet(
  BuildContext context, {
  required String companyId,
  required double? currentRate,
  required List<Product> products,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _UsdRateSheet(
      companyId: companyId,
      currentRate: currentRate,
      products: products,
    ),
  );
}

class _UsdRateSheet extends ConsumerStatefulWidget {
  const _UsdRateSheet({
    required this.companyId,
    required this.currentRate,
    required this.products,
  });

  final String companyId;
  final double? currentRate;
  final List<Product> products;

  @override
  ConsumerState<_UsdRateSheet> createState() => _UsdRateSheetState();
}

class _UsdRateSheetState extends ConsumerState<_UsdRateSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _rateController;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final rate = widget.currentRate;
    _rateController = TextEditingController(
      text: rate == null ? '' : usdAmountInputText(rate),
    );
  }

  @override
  void dispose() {
    _rateController.dispose();
    super.dispose();
  }

  double? get _typedRate => double.tryParse(_rateController.text.trim());

  String? _validate(String? _) =>
      UsdPricing.isValidRate(_typedRate) ? null : context.l10n.usdRateInvalid;

  Future<void> _save() async {
    if (_saving || !(_formKey.currentState?.validate() ?? false)) return;
    final l10n = context.l10n;
    final rate = _typedRate!;
    final old = widget.currentRate;
    if (UsdPricing.isBigChange(old, rate)) {
      final sure = await showConfirmationDialog(
        context,
        title: l10n.usdRateBigChangeTitle,
        body: l10n.usdRateBigChangeBody(
          formatUsdAmount(rate),
          formatUsdAmount(old!),
          ((rate - old).abs() / old * 100).round(),
        ),
        confirmLabel: l10n.usdRateBigChangeConfirm,
      );
      if (!sure || !mounted) return;
    }
    setState(() => _saving = true);
    final error = await ref
        .read(companyAdminActionsProvider)
        .setUsdRate(widget.companyId, rate, widget.products);
    if (!mounted) return;
    setState(() => _saving = false);
    final messenger = ScaffoldMessenger.of(context);
    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error, messenger: messenger);
      return;
    }
    final saved = l10n.usdRateSaved;
    Navigator.of(context).pop();
    showAppSnackBar(context, saved, tone: AppTone.success, messenger: messenger);
  }

  /// What saving [rate] does to the dollar products, or null while the typed
  /// rate is not one that can be saved.
  String? _preview(AppLocalizations l10n, double? rate) {
    final usd = widget.products.where((p) => p.isPricedInUsd).toList();
    if (usd.isEmpty) return l10n.usdRateNoProducts;
    if (!UsdPricing.isValidRate(rate)) return null;
    final changing =
        usd.where((p) => UsdPricing.needsRepricing(p, rate!)).toList();
    if (changing.isEmpty) return null;
    final example = changing.first;
    final to = UsdPricing.price(example.priceUsd!, rate!);
    return l10n.usdRatePreview(
      changing.length,
      example.name,
      formatProductPrice(example.price ?? 0),
      formatProductPrice(to),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final reminderOn = ref
            .watch(pushPrefsProvider)
            .asData
            ?.value
            .isOn(PushCategory.usdRate) ??
        true;
    final preview = _preview(l10n, _typedRate);
    return Padding(
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
            Text(l10n.usdRateTitle, style: AppTextStyles.h2),
            const SizedBox(height: AppSpacing.s16),
            AppTextField(
              key: const ValueKey('usd-rate-field'),
              label: l10n.usdRateFieldLabel,
              controller: _rateController,
              enabled: !_saving,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
              ],
              textDirection: TextDirection.ltr,
              prefixIcon: Icons.currency_exchange_rounded,
              validator: _validate,
              onChanged: (_) => setState(() {}),
              onFieldSubmitted: (_) => _save(),
            ),
            if (preview != null) ...[
              const SizedBox(height: AppSpacing.s12),
              AppBanner(message: preview, tone: AppTone.info),
            ],
            const SizedBox(height: AppSpacing.s8),
            SwitchListTile(
              key: const ValueKey('usd-rate-reminder'),
              contentPadding: EdgeInsets.zero,
              value: reminderOn,
              title: Text(l10n.usdRateReminder, style: AppTextStyles.bodyStrong),
              subtitle: Text(
                l10n.usdRateReminderHint,
                style: AppTextStyles.caption
                    .copyWith(color: context.colors.textSecondary),
              ),
              onChanged: (value) {
                final uid = ref.read(currentUserIdProvider);
                if (uid == null) return;
                ref
                    .read(pushPrefsStoreProvider)
                    .set(uid, PushCategory.usdRate, value)
                    .catchError((Object _) {});
              },
            ),
            const SizedBox(height: AppSpacing.s12),
            AppButton.primary(
              key: const ValueKey('usd-rate-save'),
              label: l10n.usdRateSave,
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
