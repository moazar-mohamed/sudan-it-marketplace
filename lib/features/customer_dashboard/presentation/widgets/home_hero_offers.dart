import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../offers/domain/offer_item.dart';
import '../../../offers/presentation/offer_card.dart';
import '../../../offers/presentation/offer_price.dart';
import 'home_design.dart';

/// The big banner at the top of the products tab: the best offers one at a
/// time on a dark card, swiped sideways, with dots underneath. Moves on by
/// itself every few seconds (and back to the first after the last), pausing
/// while a finger is on it; stays still when the device asks for no
/// animations. Shows nothing when no offer runs.
class HomeHeroOffers extends StatefulWidget {
  const HomeHeroOffers({
    super.key,
    required this.offers,
    this.categories = const {},
    this.maxItems = 5,
  });

  /// Running offers, best discount first (see [runningOffers]).
  final List<OfferItem> offers;
  final Map<String, Category> categories;
  final int maxItems;

  @override
  State<HomeHeroOffers> createState() => _HomeHeroOffersState();
}

class _HomeHeroOffersState extends State<HomeHeroOffers> {
  /// How long an offer stays before the next one slides in.
  static const _autoPlayEvery = Duration(seconds: 5);

  final _controller = PageController(viewportFraction: 0.92);
  Timer? _timer;
  int _page = 0;
  int _count = 0;
  bool _touching = false;

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  /// Arms the next move; every touch or move restarts the full wait.
  void _schedule() {
    _timer?.cancel();
    _timer = Timer(_autoPlayEvery, _advance);
  }

  void _advance() {
    if (!mounted) return;
    final still = _touching || MediaQuery.disableAnimationsOf(context);
    if (!still && _count > 1 && _controller.hasClients) {
      _controller.animateToPage(
        (_page + 1) % _count,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeInOut,
      );
    }
    _schedule();
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.offers.take(widget.maxItems).toList();
    _count = items.length;
    if (items.isEmpty) return const SizedBox.shrink();
    final colors = context.colors;
    // The card has a fixed height, so very large text is capped here.
    final media = MediaQuery.of(context);
    final scale = math.min(media.textScaler.scale(1), 1.2);
    return MediaQuery(
      data: media.copyWith(textScaler: TextScaler.linear(scale)),
      child: Column(
        key: const ValueKey('home-hero'),
        children: [
          SizedBox(
            height: 212 * (1 + (scale - 1) * 0.7),
            child: Listener(
              onPointerDown: (_) {
                _touching = true;
                _schedule();
              },
              onPointerUp: (_) => _touching = false,
              onPointerCancel: (_) => _touching = false,
              child: PageView.builder(
                controller: _controller,
                itemCount: items.length,
                onPageChanged: (page) {
                  setState(() => _page = page);
                  _schedule();
                },
                itemBuilder: (context, index) => Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.s4,
                  ),
                  child: _HeroCard(
                    item: items[index],
                    look: CategoryLook.of(
                      widget.categories[items[index].categoryId],
                      fallbackId: items[index].id,
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (items.length > 1) ...[
            const SizedBox(height: AppSpacing.s8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < items.length; i++)
                  AnimatedContainer(
                    duration: AppMotion.state,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: i == _page ? 22 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: i == _page
                          ? colors.primary
                          : colors.borderInput.withValues(alpha: 0.45),
                      borderRadius: AppRadius.fullAll,
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

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.item, required this.look});

  final OfferItem item;
  final CategoryLook look;

  @override
  Widget build(BuildContext context) {
    final pricing = item.pricing;
    final sale = pricing.salePrice;
    final isService = item is ServiceOfferItem;
    const onNavy = Colors.white;
    final muted = Colors.white.withValues(alpha: 0.6);
    return Semantics(
      button: true,
      label: item.name,
      child: Material(
        color: HomePalette.heroNavy,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => openOfferItem(context, item),
          child: LayoutBuilder(
            builder: (context, constraints) {
              // On a narrow phone the picture would squeeze the text; drop it.
              final showPicture = constraints.maxWidth >= 330;
              return Padding(
                padding: const EdgeInsets.all(AppSpacing.s16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          OfferPill(
                            label: offerBadgeLabel(context, pricing),
                            large: true,
                          ),
                          Text(
                            item.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.h2.copyWith(
                              color: onNavy,
                              fontWeight: FontWeight.w700,
                              height: 1.3,
                            ),
                          ),
                          Wrap(
                            crossAxisAlignment: WrapCrossAlignment.end,
                            spacing: AppSpacing.s8,
                            children: [
                              if (sale != null)
                                Text.rich(
                                  TextSpan(
                                    children: [
                                      TextSpan(
                                        text: formatProductPrice(sale),
                                        style: AppTextStyles.h1.copyWith(
                                          color: onNavy,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      TextSpan(
                                        text: ' ${item.currency}',
                                        style: AppTextStyles.captionStrong
                                            .copyWith(color: muted),
                                      ),
                                    ],
                                  ),
                                ),
                              if (pricing.hasActiveOffer &&
                                  pricing.price != null)
                                Text(
                                  formatProductPrice(pricing.price!),
                                  style: AppTextStyles.body.copyWith(
                                    color: muted,
                                    decoration: TextDecoration.lineThrough,
                                    decorationColor: muted,
                                  ),
                                ),
                            ],
                          ),
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: AlignmentDirectional.centerStart,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: AppRadius.mdAll,
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.s16,
                                  vertical: AppSpacing.s8,
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      isService
                                          ? context.l10n.serviceRequestAction
                                          : context.l10n.homeShopNow,
                                      style: AppTextStyles.buttonMedium
                                          .copyWith(
                                            color: HomePalette.heroNavy,
                                          ),
                                    ),
                                    const SizedBox(width: AppSpacing.s8),
                                    const Icon(
                                      Icons.arrow_forward_rounded,
                                      size: AppSize.iconMd,
                                      color: HomePalette.heroNavy,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (showPicture) ...[
                      const SizedBox(width: AppSpacing.s12),
                      Container(
                        width: 108,
                        height: 108,
                        clipBehavior: Clip.antiAlias,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: AppNetworkImage(
                          url: item.imageUrl ?? '',
                          fallback: Icon(
                            look.icon,
                            size: 52,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
