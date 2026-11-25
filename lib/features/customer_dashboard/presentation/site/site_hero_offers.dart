import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../offers/domain/offer_item.dart';
import '../../../offers/presentation/offer_card.dart';
import 'site_look.dart';

/// What is left of an offer: whole days from a day on, else hh:mm:ss parts;
/// null once it is over (`offerTimeLeft` on the site).
({int? days, List<String>? parts})? siteOfferTimeLeft(
  DateTime endsAt,
  DateTime now,
) {
  final left = endsAt.difference(now);
  if (left <= Duration.zero) return null;
  if (left >= const Duration(days: 1)) return (days: left.inDays, parts: null);
  String two(int n) => n.toString().padLeft(2, '0');
  return (
    days: null,
    parts: [
      two(left.inHours),
      two(left.inMinutes.remainder(60)),
      two(left.inSeconds.remainder(60)),
    ],
  );
}

/// The big banner of the site's home (`HeroOffers`): the best running offers
/// one at a time on a navy card, swiped or picked with the dots. It moves on
/// every five seconds and back to the first after the last, waits while a
/// finger is on it, and stays still when the phone asks for no animations.
/// Each card counts down to its offer's end.
class SiteHeroOffers extends ConsumerStatefulWidget {
  const SiteHeroOffers({super.key, required this.offers});

  final List<OfferItem> offers;

  @override
  ConsumerState<SiteHeroOffers> createState() => _SiteHeroOffersState();
}

class _SiteHeroOffersState extends ConsumerState<SiteHeroOffers> {
  static const _autoPlayEvery = Duration(seconds: 5);

  final _controller = PageController();
  Timer? _autoPlay;
  Timer? _clock;
  DateTime _now = DateTime.now();
  int _page = 0;
  bool _touching = false;

  @override
  void initState() {
    super.initState();
    _scheduleAutoPlay();
    _scheduleClock();
  }

  @override
  void didUpdateWidget(SiteHeroOffers old) {
    super.didUpdateWidget(old);
    _scheduleClock();
  }

  @override
  void dispose() {
    _autoPlay?.cancel();
    _clock?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _scheduleAutoPlay() {
    _autoPlay?.cancel();
    _autoPlay = Timer(_autoPlayEvery, () {
      if (!mounted) return;
      final count = widget.offers.length;
      final still = _touching || MediaQuery.disableAnimationsOf(context);
      if (!still && count > 1 && _controller.hasClients) {
        _controller.animateToPage(
          (_page + 1) % count,
          duration: const Duration(milliseconds: 450),
          curve: Curves.easeInOut,
        );
      }
      _scheduleAutoPlay();
    });
  }

  /// Ticks every second while an offer ends within a day, else every minute.
  void _scheduleClock() {
    _clock?.cancel();
    final ends = widget.offers
        .map((o) => o.pricing.offerEndsAt)
        .whereType<DateTime>()
        .toList();
    if (ends.isEmpty) return;
    final soonest = ends.reduce((a, b) => a.isBefore(b) ? a : b);
    final underADay =
        soonest.difference(DateTime.now()) < const Duration(days: 1);
    _clock = Timer.periodic(
      underADay ? const Duration(seconds: 1) : const Duration(minutes: 1),
      (_) {
        if (mounted) setState(() => _now = DateTime.now());
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.offers;
    if (items.isEmpty) return const SizedBox.shrink();
    final colors = context.colors;
    final categories = ref.watch(categoriesByIdProvider);
    final media = MediaQuery.of(context);
    final scale = math.min(media.textScaler.scale(1), 1.2);
    return MediaQuery(
      data: media.copyWith(textScaler: TextScaler.linear(scale)),
      child: Column(
        key: const ValueKey('site-hero-offers'),
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              boxShadow: siteCardShadow(context),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: SizedBox(
                height: 230 * (1 + (scale - 1) * 0.8),
                child: Listener(
                  onPointerDown: (_) {
                    _touching = true;
                    _scheduleAutoPlay();
                  },
                  onPointerUp: (_) => _touching = false,
                  onPointerCancel: (_) => _touching = false,
                  child: PageView.builder(
                    controller: _controller,
                    itemCount: items.length,
                    onPageChanged: (page) {
                      setState(() => _page = page);
                      _scheduleAutoPlay();
                    },
                    itemBuilder: (context, index) => _Slide(
                      item: items[index],
                      now: _now,
                      emoji: siteCategoryEmoji(
                        categories[items[index].categoryId],
                        'box',
                      ),
                      color: siteCategoryColor(
                        categories[items[index].categoryId],
                        items[index].id,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (items.length > 1) ...[
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < items.length; i++)
                  GestureDetector(
                    onTap: () => _controller.animateToPage(
                      i,
                      duration: const Duration(milliseconds: 450),
                      curve: Curves.easeInOut,
                    ),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: i == _page ? 26 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: i == _page
                            ? colors.action
                            : colors.borderDefault,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Slide extends StatelessWidget {
  const _Slide({
    required this.item,
    required this.now,
    required this.emoji,
    required this.color,
  });

  final OfferItem item;
  final DateTime now;
  final String emoji;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = context.l10n;
    final pricing = item.pricing;
    final sale = pricing.salePrice;
    final old = pricing.price;
    final ends = pricing.offerEndsAt;
    final left = ends == null ? null : siteOfferTimeLeft(ends, now);
    final image = (item.imageUrl ?? '').trim();
    final muted = Colors.white.withValues(alpha: 0.8);

    return Semantics(
      button: true,
      label: item.name,
      child: GestureDetector(
        onTap: () => openOfferItem(context, item),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF063B73), Color(0xFF052B57)],
            ),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // The faint green light in a corner and the dot pattern.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topLeft,
                    radius: 1.1,
                    colors: [Color(0x471FA35C), Color(0x001FA35C)],
                  ),
                ),
              ),
              const CustomPaint(painter: _DotsPainter()),
              LayoutBuilder(
                builder: (context, constraints) {
                  final picture = constraints.maxWidth >= 330;
                  // Very large text could need more than the card's height:
                  // it is cut at the card's edge rather than spilling out.
                  return SingleChildScrollView(
                    physics: const NeverScrollableScrollPhysics(),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: constraints.maxHeight,
                      ),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SitePill(
                                    label: siteOfferLabel(context, pricing),
                                    background: const Color(0xFFD32F2F),
                                    foreground: Colors.white,
                                    fontSize: 13,
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 4,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    item.name,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTextStyles.h2.copyWith(
                                      color: Colors.white,
                                      fontSize: 20,
                                      fontWeight: FontWeight.w800,
                                      height: 1.35,
                                    ),
                                  ),
                                  if (sale != null) ...[
                                    const SizedBox(height: 8),
                                    Wrap(
                                      crossAxisAlignment:
                                          WrapCrossAlignment.end,
                                      spacing: 12,
                                      children: [
                                        Text(
                                          sitePrice(
                                            context,
                                            sale,
                                            item.currency,
                                          ),
                                          style: AppTextStyles.h1.copyWith(
                                            color: Colors.white,
                                            fontSize: 22,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        if (old != null && old != sale)
                                          Text(
                                            sitePrice(
                                              context,
                                              old,
                                              item.currency,
                                            ),
                                            style: AppTextStyles.body.copyWith(
                                              color: Colors.white.withValues(
                                                alpha: 0.62,
                                              ),
                                              decoration:
                                                  TextDecoration.lineThrough,
                                              decorationColor: Colors.white
                                                  .withValues(alpha: 0.62),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                  if (left != null) ...[
                                    const SizedBox(height: 8),
                                    _EndsIn(left: left, color: muted),
                                  ],
                                  const SizedBox(height: 12),
                                  DecoratedBox(
                                    decoration: BoxDecoration(
                                      color: colors.action,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 20,
                                        vertical: 10,
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(
                                            item is ServiceOfferItem
                                                ? l10n.siteRequestService
                                                : l10n.siteShopNow,
                                            style: AppTextStyles.buttonMedium
                                                .copyWith(color: Colors.white),
                                          ),
                                          const SizedBox(width: 8),
                                          const Icon(
                                            Icons.arrow_forward_rounded,
                                            size: 18,
                                            color: Colors.white,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (picture) ...[
                              const SizedBox(width: 12),
                              Container(
                                width: 92,
                                height: 92,
                                clipBehavior: Clip.antiAlias,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: image.isEmpty ? color : null,
                                  gradient: image.isEmpty
                                      ? LinearGradient(
                                          colors: [
                                            color,
                                            color.withValues(alpha: 0.7),
                                          ],
                                        )
                                      : null,
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.14),
                                    width: 4,
                                  ),
                                ),
                                child: image.isEmpty
                                    ? Center(
                                        child: SiteGlyph(
                                          emoji: emoji,
                                          size: 44,
                                        ),
                                      )
                                    : AppNetworkImage(
                                        url: image,
                                        fallback: Center(
                                          child: SiteGlyph(
                                            emoji: emoji,
                                            size: 44,
                                          ),
                                        ),
                                      ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// «ينتهي خلال 3 أيام», or «ينتهي خلال» with hh:mm:ss in small boxes.
class _EndsIn extends StatelessWidget {
  const _EndsIn({required this.left, required this.color});

  final ({int? days, List<String>? parts}) left;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final style = AppTextStyles.captionStrong.copyWith(
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: color,
    );
    final days = left.days;
    if (days != null) {
      return Text(
        '${l10n.siteEndsIn} ${l10n.siteDaysLeft(days)}',
        style: style,
      );
    }
    final parts = left.parts!;
    return Wrap(
      key: const ValueKey('site-offer-clock'),
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 4,
      children: [
        Text(l10n.siteEndsIn, style: style),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < parts.length; i++) ...[
                if (i > 0)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Text(
                      ':',
                      style: style.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                Container(
                  constraints: const BoxConstraints(minWidth: 30),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    parts[i],
                    textAlign: TextAlign.center,
                    style: style.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// The faint dot pattern of the site's navy and teal cards.
class _DotsPainter extends CustomPainter {
  const _DotsPainter({this.opacity = 0.08});

  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: opacity);
    for (double y = 11; y < size.height; y += 22) {
      for (double x = 11; x < size.width; x += 22) {
        canvas.drawCircle(Offset(x, y), 1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotsPainter old) => old.opacity != opacity;
}

/// The same dots, for the home's search hero.
class SiteDots extends StatelessWidget {
  const SiteDots({super.key, this.opacity = 0.09});

  final double opacity;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(painter: _DotsPainter(opacity: opacity));
}
