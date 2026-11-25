import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:share_plus/share_plus.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../reviews/domain/review.dart';
import '../../../reviews/presentation/review_widgets.dart';
import 'site_cards.dart';
import 'site_look.dart';

/// The pieces of sictm.net's product, service and company pages
/// (`customer_web/src/pages/ProductPage.tsx` and friends), in the app.

/// The address of the customer site, for shared links.
const siteOrigin = 'https://sictm.net';

/// A page of the shop the opened pages ask the customer app to show: the
/// products or services page on [categoryId] (all of them when null).
class SiteShopRequest {
  const SiteShopRequest({
    required this.services,
    required this.categoryId,
    required this.serial,
  });

  final bool services;
  final String? categoryId;

  /// Bumped on every request, so asking twice for the same page still counts.
  final int serial;
}

/// Asks the customer app for one of its pages from a screen opened on top of
/// it (a breadcrumb on a product page); the app listens and switches.
final siteShopRequestProvider =
    NotifierProvider<SiteShopRequests, SiteShopRequest?>(SiteShopRequests.new);

class SiteShopRequests extends Notifier<SiteShopRequest?> {
  @override
  SiteShopRequest? build() => null;

  void open({required bool services, String? categoryId}) {
    state = SiteShopRequest(
      services: services,
      categoryId: categoryId,
      serial: (state?.serial ?? 0) + 1,
    );
  }
}

/// Back to the customer app on the products (or services) page of
/// [categoryId], closing the pages opened on top of it.
void siteOpenShop(
  BuildContext context,
  WidgetRef ref, {
  bool services = false,
  String? categoryId,
}) {
  ref
      .read(siteShopRequestProvider.notifier)
      .open(services: services, categoryId: categoryId);
  Navigator.of(context).popUntil((route) => route.isFirst);
}

/// The arrow between the steps of a path: it points the way the text reads
/// (`PATH_SEPARATOR`).
String sitePathSeparator(BuildContext context) =>
    Directionality.of(context) == TextDirection.rtl ? '‹' : '›';

/// «كل الأقسام ‹ … ‹ الاسم» (`Breadcrumbs`): the steps with an action are
/// links, the last one is the page itself.
class SiteCrumbs extends StatelessWidget {
  const SiteCrumbs({super.key, required this.items});

  final List<(String, VoidCallback?)> items;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final style = AppTextStyles.body.copyWith(
      fontSize: 14,
      color: colors.textSecondary,
    );
    final separator = sitePathSeparator(context);
    return Semantics(
      container: true,
      child: Wrap(
        spacing: 6,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) ExcludeSemantics(child: Text(separator, style: style)),
            if (items[i].$2 == null)
              Text(
                items[i].$1,
                style: style.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colors.textPrimary,
                ),
              )
            else
              InkWell(
                onTap: items[i].$2,
                borderRadius: BorderRadius.circular(6),
                child: Text(items[i].$1, style: style),
              ),
          ],
        ],
      ),
    );
  }
}

/// A block of a page (`.tile`): the surface with a thin line, 18 px corners.
class SiteTile extends StatelessWidget {
  const SiteTile({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(28),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.borderDefault),
      ),
      child: child,
    );
  }
}

/// A tile's title (`.tile h2`): 22 px, extra bold.
class SiteTileTitle extends StatelessWidget {
  const SiteTileTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      child: Text(
        text,
        style: AppTextStyles.h2.copyWith(
          fontSize: 22,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

/// A tile with a title, maybe a status at the end of its line (`.tile-head`),
/// and its content below.
class SiteSection extends StatelessWidget {
  const SiteSection({
    super.key,
    this.title,
    this.trailing,
    this.gap = 12,
    required this.children,
  });

  final String? title;
  final Widget? trailing;
  final double gap;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SiteTile(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Row(
              children: [
                Expanded(child: SiteTileTitle(title!)),
                if (trailing != null) ...[
                  const SizedBox(width: 8),
                  trailing!,
                ],
              ],
            ),
            SizedBox(height: gap),
          ],
          ...children,
        ],
      ),
    );
  }
}

/// One rounded block of rows (`.rows`): a thin line between them.
class SiteRows extends StatelessWidget {
  const SiteRows({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) Divider(height: 1, color: colors.borderDefault),
            children[i],
          ],
        ],
      ),
    );
  }
}

/// A row of [SiteRows] (`.row`): an icon, the label, maybe something at the
/// end; pressed as a whole when [onTap] is set.
class SiteRow extends StatelessWidget {
  const SiteRow({
    super.key,
    required this.label,
    this.icon,
    this.trailing,
    this.onTap,
    this.muted = false,
  });

  final String label;
  final IconData? icon;
  final Widget? trailing;
  final VoidCallback? onTap;

  /// The label in grey (a value row such as the phone number).
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          child: Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 22, color: colors.textPrimary),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Text(
                  label,
                  style: AppTextStyles.body.copyWith(
                    fontSize: muted ? 13 : 15,
                    color: muted ? colors.textSecondary : colors.textPrimary,
                  ),
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 12),
                Flexible(child: trailing!),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A block of a page with a title and its text (`.tile h2` + `.prose`).
class SiteProseTile extends StatelessWidget {
  const SiteProseTile({super.key, required this.title, required this.text});

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return SiteTile(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SiteTileTitle(title),
          const SizedBox(height: 12),
          SiteProse(text),
        ],
      ),
    );
  }
}

/// Long text as the site writes it (`.prose`): grey, roomy lines.
class SiteProse extends StatelessWidget {
  const SiteProse(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppTextStyles.body.copyWith(
        height: 1.9,
        color: context.colors.textSecondary,
      ),
    );
  }
}

/// «متوفر (3)» green or «غير متوفر في المخزون» red (`.status.ok` / `.off`).
class SiteStatusPill extends StatelessWidget {
  const SiteStatusPill({super.key, required this.label, required this.ok});

  final String label;
  final bool ok;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SitePill(
      label: label,
      background: ok ? colors.successSubtle : colors.errorSubtle,
      foreground: ok ? colors.successText : colors.errorText,
      fontSize: 13,
    );
  }
}

/// A light round button of the product page (`.share-btn`,
/// `.compare-btn.inline`): 38 px high, a thin line, grey words; navy and
/// white while [selected].
class SiteLinePill extends StatelessWidget {
  const SiteLinePill({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.selected = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final ink = selected ? colors.textInverse : colors.textSecondary;
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? colors.bgInverse : colors.surface,
        shape: StadiumBorder(
          side: BorderSide(
            color: selected ? Colors.transparent : colors.borderDefault,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            height: 38,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: ink),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.captionStrong.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: ink,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// «مشاركة»: the phone's share sheet with the page's link on sictm.net
/// ([path] such as `/product/<id>`).
class SiteShareButton extends StatelessWidget {
  const SiteShareButton({super.key, required this.title, required this.path});

  final String title;
  final String path;

  @override
  Widget build(BuildContext context) {
    return SiteLinePill(
      icon: Icons.share_outlined,
      label: context.l10n.siteShare,
      onTap: () {
        final url = '$siteOrigin$path';
        SharePlus.instance.share(
          ShareParams(text: '$title\n$url', title: title, subject: title),
        );
      },
    );
  }
}

/// A grey note with an icon (`.note`): the installation offer.
class SiteNote extends StatelessWidget {
  const SiteNote({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;

  /// A bold first line; empty for a note of one paragraph.
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final style = AppTextStyles.body.copyWith(fontSize: 14, height: 1.7);
    if (title.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: colors.bgSubtle,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: colors.textPrimary),
            const SizedBox(width: 12),
            Expanded(child: Text(message, style: style)),
          ],
        ),
      );
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: colors.bgSubtle,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: colors.textPrimary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: style.copyWith(fontWeight: FontWeight.w700)),
                Text(message, style: style),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The seller on a product page (`.company-box`): the logo, the name and
/// stars, and an arrow when it opens the company.
class SiteCompanyBox extends StatelessWidget {
  const SiteCompanyBox({
    super.key,
    required this.name,
    this.company,
    this.rating,
    this.onTap,
  });

  final String name;

  /// The seller when it is known: its logo (else the first letter of [name]).
  final Company? company;
  final Widget? rating;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colors.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              if (company != null)
                SiteCompanyLogo(company: company!, size: 48)
              else
                Container(
                  width: 46,
                  height: 46,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.bgSubtle,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    name.trim().isEmpty ? '?' : name.trim().characters.first,
                    style: AppTextStyles.bodyStrong.copyWith(
                      fontWeight: FontWeight.w800,
                      color: colors.textBrand,
                    ),
                  ),
                ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodyStrong.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    ?rating,
                  ],
                ),
              ),
              if (onTap != null) ...[
                const SizedBox(width: 8),
                Icon(
                  Icons.arrow_forward_rounded,
                  size: 18,
                  color: colors.textSecondary,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The specifications (`.specs`): the name grey on one side, the value bold
/// on the other, a line between rows.
class SiteSpecs extends StatelessWidget {
  const SiteSpecs({super.key, required this.entries});

  final List<MapEntry<String, String>> entries;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      children: [
        for (var i = 0; i < entries.length; i++)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              border: i == entries.length - 1
                  ? null
                  : Border(bottom: BorderSide(color: colors.borderDefault)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    entries[i].key,
                    style: AppTextStyles.body.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    entries[i].value,
                    textAlign: TextAlign.end,
                    style: AppTextStyles.body.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// A price summary (`.specs` + `.total-row`): the rows, then a bold total in
/// green under a thicker line.
class SiteSummary extends StatelessWidget {
  const SiteSummary({super.key, required this.rows, required this.total});

  final List<(String, String)> rows;
  final (String, String) total;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      children: [
        SiteSpecs(entries: [for (final (k, v) in rows) MapEntry(k, v)]),
        Container(
          margin: const EdgeInsets.only(top: 4),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: colors.borderDefault, width: 2),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  total.$1,
                  style: AppTextStyles.h3.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Text(
                total.$2,
                style: AppTextStyles.h3.copyWith(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: colors.price,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// "15 November 2026" / «15 نوفمبر 2026», as the site writes a date
/// (`formatDate`: the month in words, Latin digits).
String siteLongDate(BuildContext context, DateTime value) {
  final language = Localizations.localeOf(context).languageCode;
  final text = DateFormat.yMMMMd(language == 'ar' ? 'ar' : 'en_GB')
      .format(value.toLocal());
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return text.replaceAllMapped(
    RegExp('[٠-٩]'),
    (m) => '${arabicDigits.indexOf(m[0]!)}',
  );
}

/// "2026-11-15", as the site dates a review.
String siteIsoDate(DateTime value) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${value.year}-${two(value.month)}-${two(value.day)}';
}

/// What customers said (`ReviewsSection`): the average in big figures with
/// the stars and the count, then three reviews and «عرض كل التقييمات (n)».
/// Nothing at all until someone has rated.
class SiteReviews extends ConsumerStatefulWidget {
  const SiteReviews({
    super.key,
    required this.provider,
    this.preview = 3,
    this.spaceAbove = 16,
  });

  /// `targetReviewsProvider(id)` or `companyPublicReviewsProvider(id)`.
  final StreamProvider<List<Review>> provider;
  final int preview;

  /// The page's gap above the tile, only while it shows.
  final double spaceAbove;

  @override
  ConsumerState<SiteReviews> createState() => _SiteReviewsState();
}

class _SiteReviewsState extends ConsumerState<SiteReviews> {
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final reviews =
        ref.watch(widget.provider).asData?.value ?? const <Review>[];
    if (reviews.isEmpty) return const SizedBox.shrink();
    final l10n = context.l10n;
    final colors = context.colors;
    final average =
        reviews.fold<int>(0, (sum, r) => sum + r.stars) / reviews.length;
    final shown = _all ? reviews : reviews.take(widget.preview).toList();
    final tile = SiteTile(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SiteTileTitle(l10n.reviewsTitle),
          const SizedBox(height: 16),
          Row(
            children: [
              Text(
                average.toStringAsFixed(1),
                style: AppTextStyles.h1.copyWith(
                  fontSize: 40,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                ),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SiteStars(value: average, size: 16),
                  Text(
                    l10n.siteReviewsCount(reviews.length),
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 13,
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
          ),
          for (final review in shown) _SiteReview(review: review),
          if (!_all && reviews.length > widget.preview) ...[
            const SizedBox(height: 12),
            InkWell(
              onTap: () => setState(() => _all = true),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Text(
                  l10n.siteReviewsAll(reviews.length),
                  style: AppTextStyles.bodyStrong.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: colors.textBrand,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
    return Padding(
      padding: EdgeInsets.only(top: widget.spaceAbove),
      child: tile,
    );
  }
}

class _SiteReview extends StatelessWidget {
  const _SiteReview({required this.review});

  final Review review;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final name = review.authorName.trim().isEmpty
        ? l10n.siteCustomer
        : review.authorName.trim();
    final reply = review.reply?.trim() ?? '';
    final comment = review.comment.trim();
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.only(top: 16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.borderDefault)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.bgSubtle,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  name.characters.first,
                  style: AppTextStyles.bodyStrong.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colors.textBrand,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodyStrong.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      l10n.reviewVerified,
                      style: AppTextStyles.caption.copyWith(
                        fontSize: 12,
                        color: colors.successText,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  SiteStars(value: review.stars.toDouble()),
                  Text(
                    siteIsoDate(review.createdAt),
                    textDirection: TextDirection.ltr,
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 13,
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
          ),
          if (review.tags.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final tag in review.tags)
                  SitePill(
                    label: reviewTagLabel(l10n, tag),
                    background: colors.bgSubtle,
                    foreground: colors.textSecondary,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 2,
                    ),
                  ),
              ],
            ),
          ],
          if (comment.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(comment, style: AppTextStyles.body.copyWith(height: 1.8)),
          ],
          if (reply.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: colors.bgSubtle,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.siteCompanyReplyFrom(review.companyName),
                    style: AppTextStyles.bodyStrong.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(reply, style: AppTextStyles.body.copyWith(fontSize: 14)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
