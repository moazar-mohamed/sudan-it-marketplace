import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../offers/domain/offer_item.dart';
import '../../../offers/presentation/offer_card.dart';
import '../../../offers/presentation/offer_price.dart';
import 'home_design.dart';
import 'offer_countdown.dart';

/// "Featured offers" on the customer home: a white band with a sideways row
/// of the products and services on offer, the countdown to the one that ends
/// first, and "View all" opening every one of them. Shows nothing when no
/// offer runs.
class FeaturedOffersStrip extends StatelessWidget {
  const FeaturedOffersStrip({
    super.key,
    required this.offers,
    this.categories = const {},
    this.horizontalPadding = 0,
  });

  /// Running offers, already sorted by [runningOffers].
  final List<OfferItem> offers;

  /// Used to colour a card by its category.
  final Map<String, Category> categories;

  /// Side space of the header and the first card; the row itself scrolls to
  /// the screen edge.
  final double horizontalPadding;

  @override
  Widget build(BuildContext context) {
    if (offers.isEmpty) return const SizedBox.shrink();
    final colors = context.colors;
    final endsAt = _soonestEnd(offers);
    final side = EdgeInsets.symmetric(horizontal: horizontalPadding);
    return ColoredBox(
      key: const ValueKey('featured-offers'),
      color: colors.surface,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: side,
              child: HomeSectionHeader(
                title: context.l10n.homeFeaturedOffers,
                leading: const Icon(
                  Icons.local_fire_department_rounded,
                  color: OfferColors.solid,
                  size: AppSize.iconLg,
                ),
                actionLabel: context.l10n.adminViewAll,
                actionKey: const ValueKey('featured-offers-all'),
                onAction: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        OffersScreen(offers: offers, categories: categories),
                  ),
                ),
              ),
            ),
            if (endsAt != null)
              Padding(
                padding: side.copyWith(top: AppSpacing.s2),
                child: OfferCountdown(endsAt: endsAt),
              ),
            const SizedBox(height: AppSpacing.s12),
            SizedBox(
              height: OfferCard.rowHeightFor(context),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: side,
                itemCount: offers.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: AppSpacing.s12),
                // Each card keeps its own height instead of stretching to the row.
                itemBuilder: (context, index) => Align(
                  alignment: Alignment.topCenter,
                  child: OfferCardForHome(
                    item: offers[index],
                    categories: categories,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// When the first of the running offers ends; null when none has an end date.
  static DateTime? _soonestEnd(List<OfferItem> offers) {
    DateTime? soonest;
    for (final offer in offers) {
      final ends = offer.pricing.offerEndsAt;
      if (ends != null && (soonest == null || ends.isBefore(soonest))) {
        soonest = ends;
      }
    }
    return soonest;
  }
}

/// An [OfferCard] drawn in the colours of its category, opening the offer.
class OfferCardForHome extends StatelessWidget {
  const OfferCardForHome({
    super.key,
    required this.item,
    required this.categories,
    this.width = OfferCard.defaultWidth,
  });

  final OfferItem item;
  final Map<String, Category> categories;
  final double width;

  @override
  Widget build(BuildContext context) {
    final look = CategoryLook.of(
      categories[item.categoryId],
      fallbackId: item.id,
    );
    return OfferCard(
      item: item,
      width: width,
      tint: look.tint(context),
      icon: look.icon,
      iconColor: look.accent,
      onTap: () => openOfferItem(context, item),
    );
  }
}

/// Every running offer, from the home row's "View all".
class OffersScreen extends StatelessWidget {
  const OffersScreen({
    super.key,
    required this.offers,
    this.categories = const {},
  });

  final List<OfferItem> offers;
  final Map<String, Category> categories;

  @override
  Widget build(BuildContext context) {
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.homeFeaturedOffers)),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          margin,
          AppSpacing.s16,
          margin,
          AppSpacing.s24,
        ),
        // Two columns or more that fill the width, whatever the screen.
        child: LayoutBuilder(
          builder: (context, constraints) {
            const gap = AppSpacing.s12;
            final columns =
                (constraints.maxWidth / (OfferCard.defaultWidth + gap))
                    .floor()
                    .clamp(2, 6);
            final width =
                (constraints.maxWidth - gap * (columns - 1)) / columns;
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: [
                for (final item in offers)
                  OfferCardForHome(
                    item: item,
                    categories: categories,
                    width: width,
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
