import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../offers/domain/offer_item.dart';
import '../../../offers/presentation/offer_card.dart';

/// "Featured offers" on the customer home: a sideways row of the products
/// and services on offer, with "View all" opening every one of them. Shows
/// nothing when no offer runs.
class FeaturedOffersStrip extends StatelessWidget {
  const FeaturedOffersStrip({super.key, required this.offers});

  /// Running offers, already sorted by [runningOffers].
  final List<OfferItem> offers;

  @override
  Widget build(BuildContext context) {
    if (offers.isEmpty) return const SizedBox.shrink();
    final colors = context.colors;
    return Column(
      key: const ValueKey('featured-offers'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.local_fire_department_rounded,
              color: colors.errorText,
              size: AppSize.iconMd,
            ),
            const SizedBox(width: AppSpacing.s4),
            Expanded(
              child: Text(
                context.l10n.homeFeaturedOffers,
                style: AppTextStyles.h3,
              ),
            ),
            TextButton(
              key: const ValueKey('featured-offers-all'),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => OffersScreen(offers: offers),
                ),
              ),
              style: TextButton.styleFrom(
                foregroundColor: colors.textBrand,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s8),
                minimumSize: const Size(0, 36),
              ),
              child: Text(context.l10n.adminViewAll),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.s8),
        SizedBox(
          height: OfferCard.rowHeight,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: offers.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.s12),
            // Each card keeps its own height instead of stretching to the row.
            itemBuilder: (context, index) => Align(
              alignment: Alignment.topCenter,
              child: OfferCard(
                item: offers[index],
                onTap: () => openOfferItem(context, offers[index]),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Every running offer, from the home row's "View all".
class OffersScreen extends StatelessWidget {
  const OffersScreen({super.key, required this.offers});

  final List<OfferItem> offers;

  @override
  Widget build(BuildContext context) {
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.homeFeaturedOffers)),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
        // Two columns or more that fill the width, whatever the screen.
        child: LayoutBuilder(
          builder: (context, constraints) {
            const gap = AppSpacing.s12;
            final columns = (constraints.maxWidth / (OfferCard.defaultWidth + gap))
                .floor()
                .clamp(2, 6);
            final width = (constraints.maxWidth - gap * (columns - 1)) / columns;
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: [
                for (final item in offers)
                  OfferCard(
                    item: item,
                    width: width,
                    onTap: () => openOfferItem(context, item),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
