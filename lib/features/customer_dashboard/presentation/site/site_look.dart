import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../offers/domain/offer_pricing.dart';
import '../../../offers/presentation/offer_price.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/reviews_providers.dart';

/// The pieces of sictm.net's look shared by the customer pages of the app,
/// copied from `customer_web/src/styles.css` and its components.

/// The site's category colours (`COLORS` in customer_web/src/data/format.ts).
const _categoryColors = <String, Color>{
  'blue': Color(0xFF1E6FD9),
  'green': Color(0xFF16A34A),
  'purple': Color(0xFF9333EA),
  'red': Color(0xFFE11D48),
  'indigo': Color(0xFF4F46E5),
  'amber': Color(0xFFF59E0B),
  'teal': Color(0xFF0D9488),
  'sky': Color(0xFF0284C7),
  'orange': Color(0xFFF97316),
  'pink': Color(0xFFDB2777),
};

int _hash(String id) {
  var h = 0;
  for (final unit in id.codeUnits) {
    h = (h * 31 + unit).toSigned(32);
  }
  return h.abs();
}

/// Platform Admin's colour for [category], else one that stays the same for
/// it (or for [fallbackId]), exactly as the site picks it.
Color siteCategoryColor(Category? category, [String fallbackId = '']) {
  final named = category == null
      ? null
      : _categoryColors[category.colorName.trim().toLowerCase()];
  if (named != null) return named;
  final all = _categoryColors.values.toList();
  return all[_hash(category?.id ?? fallbackId) % all.length];
}

/// The shapes Platform Admin can pick (`CATEGORY_EMOJI` on the site).
const _categoryEmoji = <String, String>{
  'laptop': '💻',
  'computer': '🖥️',
  'phone': '📱',
  'tablet': '📲',
  'router': '📡',
  'network': '🌐',
  'wifi': '📶',
  'camera': '📷',
  'cctv': '🎥',
  'video': '📹',
  'printer': '🖨️',
  'server': '🗄️',
  'storage': '💾',
  'monitor': '📺',
  'keyboard': '⌨️',
  'mouse': '🖱️',
  'headset': '🎧',
  'battery': '🔋',
  'ups': '⚡',
  'cable': '🔗',
  'security': '🛡️',
  'lock': '🔒',
  'software': '🧩',
  'cloud': '☁️',
  'service': '🛠️',
  'gear': '⚙️',
  'tools': '🔧',
  'game': '🎮',
  'accessory': '🔌',
  'education': '🎓',
};

/// Words of a category's name that hint at a shape, in the site's order.
const _nameHints = <(String, List<String>)>[
  ('laptop', ['laptop', 'notebook', 'لابتوب', 'لاب توب']),
  ('computer', ['computer', 'desktop', 'كمبيوتر', 'حاسوب', 'حاسب']),
  ('phone', ['phone', 'mobile', 'موبايل', 'هاتف', 'جوال', 'تلفون']),
  ('tablet', ['tablet', 'تابلت']),
  ('router', ['router', 'telecom', 'راوتر', 'روتر', 'اتصالات']),
  ('wifi', ['wifi', 'wi-fi', 'wireless', 'واي فاي', 'وايفاي', 'لاسلكي']),
  ('network', ['network', 'switch', 'شبكه', 'شبكات', 'سويتش']),
  ('cctv', ['camera', 'cctv', 'كاميرا', 'كاميرات', 'مراقبه']),
  ('printer', ['printer', 'طابعه', 'طابعات']),
  ('server', ['server', 'virtual', 'سيرفر', 'خادم', 'خوادم', 'افتراض']),
  ('storage', ['storage', 'hard', 'ssd', 'تخزين', 'هارد', 'قرص']),
  ('monitor', ['monitor', 'screen', 'display', 'شاشه', 'شاشات']),
  ('keyboard', ['keyboard', 'كيبورد', 'لوحه مفاتيح']),
  ('mouse', ['mouse', 'ماوس']),
  ('headset', ['headset', 'headphone', 'سماعه', 'سماعات']),
  ('ups', ['ups', 'power', 'electric', 'طاقه', 'كهرب', 'يو بي اس']),
  ('battery', ['battery', 'charger', 'بطاريه', 'شاحن']),
  ('cable', ['cable', 'كيبل', 'كابل', 'كوابل']),
  (
    'security',
    ['security', 'cyber', 'firewall', 'antivirus', 'امن', 'حمايه', 'فايروول'],
  ),
  ('software', ['software', 'برنامج', 'برمجيات']),
  ('cloud', ['cloud', 'سحاب']),
  ('game', ['game', 'gaming', 'العاب']),
  ('education', ['training', 'certif', 'course', 'تدريب', 'شهادات', 'دورات']),
  ('accessory', ['accessor', 'ملحقات']),
  (
    'service',
    [
      'service',
      'خدمه',
      'خدمات',
      'installation',
      'تركيب',
      'صيانه',
      'maintenance',
    ],
  ),
];

/// Lower case, no Arabic marks, ة→ه and the alef forms folded.
String _normalize(String s) => s
    .toLowerCase()
    .replaceAll(RegExp('[ً-ٰٟ]'), '')
    .replaceAll('ة', 'ه')
    .replaceAll(RegExp('[أإآ]'), 'ا')
    .replaceAll('ى', 'ي');

/// The colourful picture of a category: the shape Platform Admin picked, else
/// one its names hint at, else a box (`categoryEmoji` on the site).
String siteCategoryEmoji(Category? category, [String fallbackKey = '']) {
  if (category == null) {
    return _categoryEmoji[fallbackKey] ?? _emojiFromName(fallbackKey) ?? '📦';
  }
  return _categoryEmoji[category.iconName.trim().toLowerCase()] ??
      _emojiFromName(
        '${category.name} ${category.nameAr} ${category.nameEn}',
      ) ??
      '📦';
}

String? _emojiFromName(String names) {
  final text = ' ${_normalize(names)} ';
  for (final (key, words) in _nameHints) {
    for (final word in words) {
      final latin = RegExp('^[a-z]').hasMatch(word);
      if (text.contains(latin ? ' $word' : word)) return _categoryEmoji[key];
    }
  }
  return null;
}

/// A category's picture at [size] (the site's `.glyph`).
class SiteGlyph extends StatelessWidget {
  const SiteGlyph({super.key, required this.emoji, this.size = 30});

  final String emoji;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Text(
        emoji,
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: size, height: 1.15),
      ),
    );
  }
}

/// "150,000 ج.س" as the site writes a price.
String sitePrice(
  BuildContext context,
  double amount, [
  String currency = 'SDG',
]) {
  final label = currency == 'SDG' ? context.l10n.siteCurrencySdg : currency;
  return '${formatProductPrice(amount)} $label';
}

/// The card shadow of the site (`--card-shadow`).
List<BoxShadow> siteCardShadow(BuildContext context) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  return [
    BoxShadow(
      color: dark ? const Color(0x33000000) : const Color(0x0F0B1D3A),
      blurRadius: 2,
      offset: const Offset(0, 1),
    ),
    BoxShadow(
      color: dark ? const Color(0x73000000) : const Color(0x260B1D3A),
      blurRadius: 24,
      spreadRadius: -12,
      offset: const Offset(0, 8),
    ),
  ];
}

/// A white card with the site's thin line, 18 px corners and soft shadow,
/// pressed as a whole ([onTap]).
class SiteCard extends StatelessWidget {
  const SiteCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
    this.radius = 18,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radius),
      side: BorderSide(color: colors.borderDefault),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        boxShadow: siteCardShadow(context),
      ),
      child: Material(
        color: colors.surface,
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// A section's title with its "View all" link (`.section-title`).
class SiteSectionTitle extends StatelessWidget {
  const SiteSectionTitle({super.key, required this.title, this.onViewAll});

  final String title;
  final VoidCallback? onViewAll;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 0, 4, 16),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              header: true,
              child: Text(
                title,
                style: AppTextStyles.h2.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          if (onViewAll != null)
            InkWell(
              onTap: onViewAll,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                child: Text(
                  context.l10n.siteViewAll,
                  style: AppTextStyles.bodyStrong.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: colors.textBrand,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A small rounded label (`.badge`, `.badge.offer`, `.ptags span`).
class SitePill extends StatelessWidget {
  const SitePill({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
    this.fontSize = 12,
    this.padding = const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
  });

  final String label;
  final Color background;
  final Color foreground;
  final double fontSize;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.captionStrong.copyWith(
          color: foreground,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
          height: 1.4,
        ),
      ),
    );
  }
}

/// The red offer badge's words ("خصم 20%", «عرض خاص», «لفترة محدودة»).
String siteOfferLabel(BuildContext context, OfferPricing pricing) =>
    offerBadgeLabel(context, pricing);

/// The price to pay, green, with the normal price struck through while an
/// offer runs; «تواصل لمعرفة السعر» without a price (`PriceText`).
class SitePriceText extends StatelessWidget {
  const SitePriceText({
    super.key,
    required this.pricing,
    this.currency = 'SDG',
    this.size = 15,
  });

  final OfferPricing pricing;
  final String currency;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final sale = pricing.salePrice;
    if (sale == null) {
      return Text(
        context.l10n.sitePriceOnRequest,
        style: AppTextStyles.bodyStrong.copyWith(
          color: colors.textSecondary,
          fontWeight: FontWeight.w700,
        ),
      );
    }
    final old = pricing.hasActiveOffer ? pricing.price : null;
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.end,
      spacing: 8,
      children: [
        Text(
          sitePrice(context, sale, currency),
          style: AppTextStyles.bodyStrong.copyWith(
            fontSize: size,
            fontWeight: FontWeight.w800,
            color: colors.price,
          ),
        ),
        if (old != null)
          Text(
            sitePrice(context, old, currency),
            style: AppTextStyles.caption.copyWith(
              fontSize: 13,
              color: colors.textSecondary,
              decoration: TextDecoration.lineThrough,
              decorationColor: colors.textSecondary,
            ),
          ),
      ],
    );
  }
}

/// Stars as the site draws them: five gold stars filled up to [value].
class SiteStars extends StatelessWidget {
  const SiteStars({super.key, required this.value, this.size = 14});

  final double value;
  final double size;

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0, 5).toDouble();
    final style = TextStyle(fontSize: size, height: 1.2, letterSpacing: 1);
    return Semantics(
      label: '${clamped.toStringAsFixed(1)} / 5',
      child: ExcludeSemantics(
        child: Stack(
          children: [
            Text(
              '★★★★★',
              style: style.copyWith(color: const Color(0x55F59E0B)),
            ),
            ClipRect(
              clipper: _FractionClipper(clamped / 5),
              child: Text(
                '★★★★★',
                style: style.copyWith(color: const Color(0xFFF59E0B)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FractionClipper extends CustomClipper<Rect> {
  _FractionClipper(this.fraction);

  final double fraction;

  @override
  Rect getClip(Size size) =>
      Rect.fromLTWH(0, 0, size.width * fraction, size.height);

  @override
  bool shouldReclip(_FractionClipper old) => old.fraction != fraction;
}

/// Stars, the average and the count, from the live ratings under [ratingKey]
/// (else the [fallbackAverage] / [fallbackCount] kept on the document);
/// «جديد» until someone rates, unless [showNew] is false (`RatingLine`).
class SiteRatingLine extends ConsumerWidget {
  const SiteRatingLine({
    super.key,
    required this.ratingKey,
    this.fallbackAverage = 0,
    this.fallbackCount = 0,
    this.showCount = true,
    this.showNew = true,
    this.pill = false,
  });

  final String ratingKey;
  final double fallbackAverage;
  final int fallbackCount;
  final bool showCount;
  final bool showNew;

  /// The company card's small yellow pill (`.ccard .rating`).
  final bool pill;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final RatingStats? stats = ref.watch(ratingStatsProvider(ratingKey));
    final count = stats?.count ?? fallbackCount;
    final average = stats != null ? stats.sum / stats.count : fallbackAverage;
    if (count == 0) {
      if (!showNew) return const SizedBox.shrink();
      return Text(
        context.l10n.siteNew,
        style: AppTextStyles.captionStrong.copyWith(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: colors.textBrand,
        ),
      );
    }
    final line = Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 6,
      children: [
        SiteStars(value: average),
        Text(
          average.toStringAsFixed(1),
          style: AppTextStyles.captionStrong.copyWith(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: colors.textPrimary,
          ),
        ),
        if (showCount) ...[
          Text(
            '(${context.l10n.siteReviewsCount(count)})',
            style: AppTextStyles.caption.copyWith(
              fontSize: 13,
              color: colors.textSecondary,
            ),
          ),
        ],
      ],
    );
    if (!pill) return line;
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: colors.warningSubtle,
        borderRadius: BorderRadius.circular(999),
      ),
      child: line,
    );
  }
}

/// A grid whose rows are as tall as their tallest card, as a CSS grid lays
/// out (the home's categories, three in a row on a phone).
class SiteGrid extends StatelessWidget {
  const SiteGrid({
    super.key,
    required this.columns,
    required this.children,
    this.spacing = 12,
  });

  final int columns;
  final List<Widget> children;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var start = 0; start < children.length; start += columns) {
      if (rows.isNotEmpty) rows.add(SizedBox(height: spacing));
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < columns; i++) ...[
                if (i > 0) SizedBox(width: spacing),
                Expanded(
                  child: start + i < children.length
                      ? children[start + i]
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ),
      );
    }
    return Column(children: rows);
  }
}

/// A round chip of the site: `.chip-link` (and `.chip-link.small`), or a
/// filter (`.filter-pill`): a thin line on the surface, navy when [selected].
class SiteChip extends StatelessWidget {
  const SiteChip({
    super.key,
    required this.label,
    required this.onTap,
    this.selected = false,
    this.small = false,
    this.trailing,
    this.maxWidth,
  });

  final String label;
  final VoidCallback onTap;
  final bool selected;
  final bool small;
  final Widget? trailing;

  /// The widest the chip may grow; a longer label ends in "…".
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final on = selected;
    return Semantics(
      button: true,
      selected: on,
      child: Material(
        color: on ? colors.bgInverse : colors.surface,
        shape: StadiumBorder(
          side: BorderSide(
            color: on ? Colors.transparent : colors.borderDefault,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            height: small ? 34 : 38,
            padding: EdgeInsets.symmetric(horizontal: small ? 14 : 16),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: maxWidth == null
                        ? double.infinity
                        : (maxWidth! -
                                  (small ? 28 : 32) -
                                  (trailing == null ? 0 : 24))
                              .clamp(24, double.infinity),
                  ),
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodyStrong.copyWith(
                      fontSize: small ? 13 : 14,
                      fontWeight: FontWeight.w600,
                      color: on ? colors.textInverse : colors.textPrimary,
                    ),
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: 8),
                  IconTheme.merge(
                    data: IconThemeData(
                      size: 16,
                      color: on ? colors.textInverse : colors.textPrimary,
                    ),
                    child: trailing!,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A pill that opens a short list to pick from (the site's `Select` with
/// `variant="pill"`), navy while [active].
class SiteMenuPill<T> extends StatelessWidget {
  const SiteMenuPill({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.active = false,
    this.maxWidth,
  });

  final double? maxWidth;
  final String label;
  final T value;
  final List<(T, String)> options;
  final ValueChanged<T> onChanged;
  final bool active;

  Future<void> _open(BuildContext context) async {
    final colors = context.colors;
    final box = context.findRenderObject()! as RenderBox;
    final overlay =
        Overlay.of(context).context.findRenderObject()! as RenderBox;
    final position = RelativeRect.fromRect(
      Rect.fromPoints(
        box.localToGlobal(Offset(0, box.size.height + 4), ancestor: overlay),
        box.localToGlobal(box.size.bottomRight(Offset.zero), ancestor: overlay),
      ),
      Offset.zero & overlay.size,
    );
    final picked = await showMenu<T>(
      context: context,
      position: position,
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: colors.borderDefault),
      ),
      items: [
        for (final (option, text) in options)
          PopupMenuItem<T>(
            value: option,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    text,
                    style: AppTextStyles.bodyStrong.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: option == value
                          ? colors.textBrand
                          : colors.textPrimary,
                    ),
                  ),
                ),
                if (option == value)
                  Icon(Icons.check_rounded, size: 18, color: colors.textBrand),
              ],
            ),
          ),
      ],
    );
    if (picked != null) onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    return Builder(
      builder: (context) => SiteChip(
        label: label,
        maxWidth: maxWidth,
        selected: active,
        trailing: const Icon(Icons.keyboard_arrow_down_rounded),
        onTap: () => _open(context),
      ),
    );
  }
}

/// The search box inside a page (`.page-search`).
class SitePageSearch extends StatelessWidget {
  const SitePageSearch({
    super.key,
    required this.controller,
    required this.hint,
    required this.onChanged,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      style: AppTextStyles.body.copyWith(fontSize: 15),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppTextStyles.body.copyWith(
          fontSize: 15,
          color: colors.textSecondary,
        ),
        prefixIcon: Icon(
          Icons.search_rounded,
          size: 20,
          color: colors.textSecondary,
        ),
        filled: true,
        fillColor: colors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 13,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colors.borderDefault),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colors.primary, width: 1.5),
        ),
      ),
    );
  }
}

/// The site's empty state (`.empty-state`): a card with a title, maybe a
/// message, and maybe a navy pill to act on it.
class SiteEmptyState extends StatelessWidget {
  const SiteEmptyState({
    super.key,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.borderDefault),
      ),
      child: Column(
        children: [
          Text(
            title,
            textAlign: TextAlign.center,
            style: AppTextStyles.h2.copyWith(
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (message != null) ...[
            const SizedBox(height: 12),
            Text(
              message!,
              textAlign: TextAlign.center,
              style: AppTextStyles.body.copyWith(color: colors.textSecondary),
            ),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 12),
            SiteActionPill(label: actionLabel!, onTap: onAction!),
          ],
        ],
      ),
    );
  }
}

/// The site's navy pill button (`.pill`): «عرض المزيد», «مسح الفلاتر».
class SiteActionPill extends StatelessWidget {
  const SiteActionPill({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: colors.bgInverse,
      shape: const StadiumBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
          child: Text(
            label,
            style: AppTextStyles.bodyStrong.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: colors.textInverse,
            ),
          ),
        ),
      ),
    );
  }
}
