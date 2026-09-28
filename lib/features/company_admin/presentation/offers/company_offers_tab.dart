import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../offers/domain/offer_item.dart';
import '../../../offers/presentation/offer_price.dart';
import '../../../offers/presentation/offers_providers.dart';
import 'offer_form_screen.dart';

/// The Catalog's Offers tab: every offer the company runs on its products
/// and services, then the ones that have ended. Each opens the offer page to
/// change or end it.
class CompanyOffersTab extends ConsumerWidget {
  const CompanyOffersTab({super.key, required this.companyId});

  final String companyId;

  void _open(BuildContext context, [OfferItem? item]) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => OfferFormScreen(companyId: companyId, initial: item),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final offersAsync = ref.watch(companyOffersProvider(companyId));
    if (offersAsync.hasError) {
      return AppErrorState(
        message: l10n.adminServicesLoadFailed,
        onRetry: () => ref.invalidate(companyOffersProvider(companyId)),
      );
    }
    final offers = offersAsync.asData?.value;
    if (offers == null) return const AppLoadingState();

    final running = runningOffers(offers);
    final ended = [
      for (final item in offers)
        if (item.pricing.hasEndedOffer) item,
    ];
    final addButton = AppButton.primary(
      key: const ValueKey('offers-add'),
      icon: Icons.add_rounded,
      label: l10n.offerAddCta,
      expand: true,
      onPressed: () => _open(context),
    );

    if (offers.isEmpty) {
      return AppCenteredList(
        children: [
          AppEmptyState(
            icon: Icons.local_offer_outlined,
            message: l10n.offersEmpty,
            action: AppButton.primary(
              icon: Icons.add_rounded,
              label: l10n.offerAddCta,
              onPressed: () => _open(context),
            ),
          ),
        ],
      );
    }
    return AppCenteredList(
      children: [
        addButton,
        if (running.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s20),
          Text(l10n.offersRunning(running.length), style: AppTextStyles.h3),
          const SizedBox(height: AppSpacing.s12),
          for (final item in running) ...[
            _OfferTile(item: item, onTap: () => _open(context, item)),
            const SizedBox(height: AppSpacing.s8),
          ],
        ],
        if (ended.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s20),
          Text(l10n.offersEnded(ended.length), style: AppTextStyles.h3),
          const SizedBox(height: AppSpacing.s12),
          for (final item in ended) ...[
            _OfferTile(item: item, onTap: () => _open(context, item)),
            const SizedBox(height: AppSpacing.s8),
          ],
        ],
      ],
    );
  }
}

class _OfferTile extends StatelessWidget {
  const _OfferTile({required this.item, required this.onTap});

  final OfferItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final pricing = item.pricing;
    final ends = pricing.offerEndsAt;
    final date = ends == null
        ? null
        : MaterialLocalizations.of(context).formatMediumDate(ends);
    final isService = item is ServiceOfferItem;
    return AppListCard(
      key: ValueKey('offer-tile-${item.id}'),
      onTap: onTap,
      leading: AppImageTile(
        imageUrl: item.imageUrl,
        fallbackIcon: isService
            ? Icons.design_services_outlined
            : Icons.inventory_2_outlined,
      ),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyStrong,
                ),
              ),
              const SizedBox(width: AppSpacing.s8),
              OfferBadgeChip(pricing: pricing, showEnded: true),
            ],
          ),
          Text(
            isService ? l10n.offerKindService : l10n.offerKindProduct,
            style: AppTextStyles.captionStrong
                .copyWith(color: colors.textBrand),
          ),
          const SizedBox(height: AppSpacing.s4),
          Wrap(
            spacing: AppSpacing.s8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                '${formatProductPrice(pricing.offerPrice!)} ${item.currency}',
                style: AppTextStyles.bodyStrong.copyWith(
                  color: pricing.hasActiveOffer
                      ? colors.textBrand
                      : colors.textSecondary,
                ),
              ),
              Text(
                formatProductPrice(pricing.price!),
                style: AppTextStyles.caption.copyWith(
                  color: colors.textTertiary,
                  decoration: TextDecoration.lineThrough,
                  decorationColor: colors.textTertiary,
                ),
              ),
            ],
          ),
          Text(
            pricing.hasEndedOffer
                ? l10n.offerEndedOn(date!)
                : date == null
                    ? l10n.offerNoEndDate
                    : l10n.offerEndsOn(date),
            style: AppTextStyles.caption.copyWith(
              color: pricing.hasEndedOffer
                  ? colors.errorText
                  : colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
