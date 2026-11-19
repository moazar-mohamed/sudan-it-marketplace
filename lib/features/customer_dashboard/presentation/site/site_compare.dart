import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/localization/locale_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/presentation/category_label.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../companies/presentation/companies_providers.dart';
import '../../../companies/presentation/company_details_screen.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/product_details_screen.dart';
import '../../../products/presentation/products_providers.dart';
import '../../../reviews/domain/review.dart';
import 'site_detail_parts.dart';
import 'site_look.dart';

/// Comparing products side by side, as on sictm.net (`data/compare.tsx`,
/// `components/Compare.tsx`, `pages/ComparePage.tsx`).

/// The most products that can be compared at once (`MAX_COMPARE`).
const siteMaxCompare = 3;
const _compareKey = 'compare-products';

/// The products picked for comparison, kept on this device until cleared.
final siteCompareProvider = NotifierProvider<SiteCompare, List<String>>(
  SiteCompare.new,
);

class SiteCompare extends Notifier<List<String>> {
  @override
  List<String> build() {
    final raw = ref.read(sharedPreferencesProvider)?.getString(_compareKey);
    if (raw == null) return const [];
    try {
      final value = jsonDecode(raw);
      if (value is! List) return const [];
      return value.whereType<String>().take(siteMaxCompare).toList();
    } on FormatException {
      return const [];
    }
  }

  void _commit(List<String> next) {
    state = List.unmodifiable(next);
    ref
        .read(sharedPreferencesProvider)
        ?.setString(_compareKey, jsonEncode(next));
  }

  bool has(String id) => state.contains(id);

  /// Adds or removes [id]; false when it could not be added (the list is full).
  bool toggle(String id) {
    if (state.contains(id)) {
      _commit([...state]..remove(id));
      return true;
    }
    if (state.length >= siteMaxCompare) return false;
    _commit([...state, id]);
    return true;
  }

  void remove(String id) {
    if (state.contains(id)) _commit([...state]..remove(id));
  }

  /// Keeps only the products still on sale ([listed] ids).
  void keepOnly(Set<String> listed) {
    final next = state.where(listed.contains).toList();
    if (next.length != state.length) _commit(next);
  }

  void clear() => _commit(const []);
}

void _toggle(BuildContext context, WidgetRef ref, String productId) {
  if (!ref.read(siteCompareProvider.notifier).toggle(productId)) {
    showAppSnackBar(context, context.l10n.siteCompareFull(siteMaxCompare));
  }
}

/// The scales button (`CompareButton`): a 38 px disc on a product card's
/// picture, or with [label] the pill «أضف للمقارنة» of the product page.
class SiteCompareButton extends ConsumerWidget {
  const SiteCompareButton({
    super.key,
    required this.productId,
    this.label = false,
  });

  final String productId;
  final bool label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final l10n = context.l10n;
    final on = ref.watch(siteCompareProvider).contains(productId);
    final text = on ? l10n.siteCompareRemove : l10n.siteCompareAdd;
    if (label) {
      return SiteLinePill(
        key: const ValueKey('compare-toggle'),
        icon: Icons.balance_rounded,
        label: text,
        selected: on,
        onTap: () => _toggle(context, ref, productId),
      );
    }
    return Semantics(
      button: true,
      selected: on,
      label: text,
      child: Tooltip(
        message: text,
        child: Material(
          color: on ? colors.bgInverse : colors.surface,
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => _toggle(context, ref, productId),
            child: SizedBox(
              width: 38,
              height: 38,
              child: Icon(
                Icons.balance_rounded,
                size: 18,
                color: on ? colors.textInverse : colors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The bar at the bottom of the screen while products are picked
/// (`CompareBar`): «⚖ 2/3», the names, «قارن الآن» and ✕. Nothing when
/// none is picked.
class SiteCompareBar extends ConsumerWidget {
  const SiteCompareBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ids = ref.watch(siteCompareProvider);
    // Until the companies are known too, every product reads as not listed,
    // so nothing leaves the comparison before both have loaded.
    final loaded = siteCatalogueLoaded(ref);
    final products = ref.watch(marketplaceProductsProvider);
    if (loaded) {
      // A product that is no longer on sale leaves the comparison.
      final listed = {for (final p in products) p.id};
      if (ids.any((id) => !listed.contains(id))) {
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => ref.read(siteCompareProvider.notifier).keepOnly(listed),
        );
      }
    }
    if (ids.isEmpty) return const SizedBox.shrink();
    final colors = context.colors;
    final l10n = context.l10n;
    final names = [
      for (final id in ids)
        ?products.where((p) => p.id == id).firstOrNull?.name,
    ];
    final wide = MediaQuery.sizeOf(context).width > 560;
    final count = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.balance_rounded, size: 18, color: colors.textBrand),
        const SizedBox(width: 6),
        Text(
          '${ids.length}/$siteMaxCompare',
          textDirection: TextDirection.ltr,
          style: AppTextStyles.bodyStrong.copyWith(
            fontWeight: FontWeight.w800,
            color: colors.textBrand,
          ),
        ),
      ],
    );
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: Semantics(
          container: true,
          label: l10n.siteCompareTitle,
          child: Container(
            key: const ValueKey('compare-bar'),
            padding: const EdgeInsetsDirectional.fromSTEB(18, 10, 12, 10),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: colors.borderDefault),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x380F1828),
                  blurRadius: 48,
                  offset: Offset(0, 16),
                ),
              ],
            ),
            child: Row(
              children: [
                count,
                const SizedBox(width: 12),
                // The names, only where there is room (not on a phone).
                if (wide) ...[
                  Expanded(
                    child: Text(
                      names.join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body.copyWith(
                        fontSize: 14,
                        color: colors.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                Flexible(
                  flex: wide ? 0 : 1,
                  // heightFactor 1: the bar stays as tall as its button, it never
                  // grows to the height the screen leaves it.
                  child: Align(
                    alignment: AlignmentDirectional.centerEnd,
                    heightFactor: 1,
                    child: _goButton(context, ids.length),
                  ),
                ),
                const SizedBox(width: 4),
                IconButton(
                  key: const ValueKey('compare-clear'),
                  tooltip: l10n.siteCompareClear,
                  onPressed: ref.read(siteCompareProvider.notifier).clear,
                  icon: const Icon(Icons.close_rounded, size: 20),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _goButton(BuildContext context, int picked) {
    final colors = context.colors;
    final l10n = context.l10n;
    return SizedBox(
      height: 44,
      child: FilledButton(
        key: const ValueKey('compare-go'),
        onPressed: picked < 2
            ? null
            : () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const SiteComparePage(),
                ),
              ),
        style: FilledButton.styleFrom(
          backgroundColor: colors.action,
          foregroundColor: Colors.white,
          disabledBackgroundColor: colors.action.withValues(alpha: 0.45),
          disabledForegroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 22),
          minimumSize: const Size(0, 44),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: Text(
          picked < 2 ? l10n.siteComparePickAnother : l10n.siteCompareNow,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

/// Whether the products and the companies they belong to have both loaded:
/// before that the marketplace list is empty or partial.
bool siteCatalogueLoaded(WidgetRef ref) =>
    ref.watch(firestoreProductsStreamProvider).hasValue &&
    ref.watch(firestoreCompaniesStreamProvider).hasValue;

/// Every specification name of [products], in the order they first appear
/// (`specNames`).
List<String> siteSpecNames(List<Product> products) {
  final names = <String>[];
  for (final p in products) {
    for (final key in p.specifications.keys) {
      if (!names.contains(key)) names.add(key);
    }
  }
  return names;
}

/// The lowest of the prices that exist, or null (`cheapestPrice`).
double? siteCheapest(List<double?> prices) {
  double? min;
  for (final v in prices) {
    if (v != null && (min == null || v < min)) min = v;
  }
  return min;
}

/// «مقارنة المنتجات»: up to three products side by side, the price, the
/// seller, availability and every specification.
class SiteComparePage extends ConsumerWidget {
  const SiteComparePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final colors = context.colors;
    final ids = ref.watch(siteCompareProvider);
    final products = ref.watch(marketplaceProductsProvider);
    final loading = !siteCatalogueLoaded(ref);
    final picked = [
      for (final id in ids) ?products.where((p) => p.id == id).firstOrNull,
    ];
    final categories = ref.watch(categoriesByIdProvider);
    final companies = ref.watch(marketplaceCompaniesProvider);

    Widget body;
    if (loading) {
      body = const AppSkeletonList(count: 2);
    } else if (picked.length < 2) {
      body = SiteEmptyState(
        title: l10n.siteCompareEmptyTitle,
        message: l10n.siteCompareEmptyMessage,
        actionLabel: l10n.siteBrowseAll,
        onAction: () => siteOpenShop(context, ref),
      );
    } else {
      final prices = [for (final p in picked) p.salePrice];
      final cheapest = siteCheapest(prices);
      final cell = AppTextStyles.body.copyWith(fontSize: 14, height: 1.6);
      String yes(bool v) => v ? l10n.siteYes : l10n.siteNo;
      final rows = <(String, Widget Function(Product, int))>[
        (
          l10n.siteComparePrice,
          (p, i) => prices[i] == null
              ? Text(l10n.sitePriceOnRequest, style: cell)
              : Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Container(
                    padding: prices[i] == cheapest
                        ? const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 2,
                          )
                        : EdgeInsets.zero,
                    decoration: prices[i] == cheapest
                        ? BoxDecoration(
                            color: colors.successSubtle,
                            borderRadius: BorderRadius.circular(999),
                          )
                        : null,
                    child: Text(
                      sitePrice(context, prices[i]!, p.currency),
                      style: cell.copyWith(
                        fontWeight: FontWeight.w800,
                        color: prices[i] == cheapest
                            ? colors.successText
                            : colors.textPrimary,
                      ),
                    ),
                  ),
                ),
        ),
        (
          l10n.siteCompareCompany,
          (p, _) {
            final company = companies
                .where((c) => c.id == p.companyId)
                .firstOrNull;
            final name = (p.companyName ?? '').trim();
            if (company == null) {
              return Text(name.isEmpty ? '—' : name, style: cell);
            }
            return InkWell(
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => CompanyDetailsScreen(company: company),
                ),
              ),
              child: Text(
                name.isEmpty ? company.name : name,
                style: cell.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colors.textBrand,
                ),
              ),
            );
          },
        ),
        (
          l10n.siteCompareBrand,
          (p, _) => Text(p.brand.isEmpty ? '—' : p.brand, style: cell),
        ),
        (
          l10n.siteCompareCategory,
          (p, _) => Text(
            categories[p.categoryId]?.localizedName(context) ?? '—',
            style: cell,
          ),
        ),
        (
          l10n.siteCompareRating,
          (p, _) => SiteRatingLine(
            ratingKey: RatingStats.keyFor('product', p.id),
            showCount: false,
          ),
        ),
        (
          l10n.siteCompareStock,
          (p, _) => Text(
            p.stockCount > 0
                ? l10n.productInStockCount(p.stockCount)
                : l10n.siteOutOfStockShort,
            style: cell,
          ),
        ),
        (
          l10n.siteCompareDelivery,
          (p, _) => Text(yes(p.isDeliveryAvailable), style: cell),
        ),
        (
          l10n.siteCompareInstall,
          (p, _) => Text(
            !p.isInstallationAvailable
                ? l10n.siteNo
                : (p.installationPrice ?? 0) > 0
                ? sitePrice(context, p.installationPrice!, p.currency)
                : l10n.siteYes,
            style: cell,
          ),
        ),
        for (final name in siteSpecNames(picked))
          (name, (p, _) => Text(p.specifications[name] ?? '—', style: cell)),
      ];

      Widget pad(Widget child) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        child: child,
      );
      final line = BorderSide(color: colors.borderDefault);
      final table = Table(
        columnWidths: const {0: FixedColumnWidth(150)},
        defaultVerticalAlignment: TableCellVerticalAlignment.top,
        border: TableBorder(horizontalInside: line),
        children: [
          TableRow(
            children: [
              const SizedBox.shrink(),
              for (final p in picked) pad(_CompareHead(product: p)),
            ],
          ),
          for (final (label, build) in rows)
            TableRow(
              children: [
                pad(
                  Text(
                    label,
                    style: cell.copyWith(
                      fontWeight: FontWeight.w600,
                      color: colors.textSecondary,
                    ),
                  ),
                ),
                for (var i = 0; i < picked.length; i++)
                  pad(build(picked[i], i)),
              ],
            ),
        ],
      );
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            key: const ValueKey('compare-table'),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: colors.borderDefault),
            ),
            clipBehavior: Clip.antiAlias,
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: math.max(560, constraints.maxWidth),
                  child: table,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            l10n.siteCompareNote,
            style: AppTextStyles.caption.copyWith(
              fontSize: 13,
              color: colors.textSecondary,
            ),
          ),
        ],
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(l10n.siteCompareTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
        children: [
          if (picked.length >= 2) ...[
            // The title and «مسح المقارنة» share a line while they fit.
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    l10n.siteCompareTitle,
                    style: AppTextStyles.h1.copyWith(
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                TextButton(
                  key: const ValueKey('compare-page-clear'),
                  onPressed: ref.read(siteCompareProvider.notifier).clear,
                  child: Text(
                    l10n.siteCompareClear,
                    style: AppTextStyles.bodyStrong.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: colors.textBrand,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
          body,
        ],
      ),
    );
  }
}

/// A product's column head: the picture, the name and «إزالة».
class _CompareHead extends ConsumerWidget {
  const _CompareHead({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final image = (product.imageUrl ?? '').trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => ProductDetailsScreen(product: product),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  width: 84,
                  height: 84,
                  color: colors.bgSubtle,
                  child: image.isEmpty
                      ? Icon(
                          Icons.inventory_2_outlined,
                          size: 34,
                          color: colors.textSecondary,
                        )
                      : AppNetworkImage(
                          url: image,
                          fit: BoxFit.cover,
                          fallback: const SizedBox.shrink(),
                        ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                product.name,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.bodyStrong.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        InkWell(
          onTap: () =>
              ref.read(siteCompareProvider.notifier).remove(product.id),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Text(
              context.l10n.siteRemove,
              style: AppTextStyles.bodyStrong.copyWith(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: colors.textBrand,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
