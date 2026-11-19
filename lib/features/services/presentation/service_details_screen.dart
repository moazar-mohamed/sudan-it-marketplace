import '../../favorites/domain/favorite.dart';
import '../../favorites/presentation/favorite_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../categories/presentation/category_label.dart';
import '../../categories/presentation/category_providers.dart';
import '../../company_services/presentation/company_service_providers.dart';
import '../../customer_dashboard/presentation/site/site_detail_parts.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../domain/entities/catalog_service.dart';
import 'widgets/service_offer_card.dart';

/// A catalogue service as on sictm.net (`pages/ServicePage.tsx`): the path,
/// a tile with the name, the heart and the description, then «الشركات
/// المتاحة», one card per company offering it (those serving the customer's
/// city first, then by name).
class ServiceDetailsScreen extends ConsumerWidget {
  const ServiceDetailsScreen({super.key, required this.service});

  final CatalogService service;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final offersAsync = ref.watch(serviceOffersProvider(service.id));
    final path = ref.watch(categoryTreeProvider).pathOf(service.categoryId);
    final description = service.description.trim();

    return Scaffold(
      appBar: AppBar(title: Text(l10n.serviceDetailsTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 48),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SiteCrumbs(
                    items: [
                      (
                        l10n.siteAllCategories,
                        () => siteOpenShop(context, ref, services: true),
                      ),
                      for (final c in path)
                        (
                          c.localizedName(context),
                          () => siteOpenShop(
                            context,
                            ref,
                            services: true,
                            categoryId: c.id,
                          ),
                        ),
                      (service.name, null),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SiteTile(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Semantics(
                                header: true,
                                child: Text(
                                  service.name,
                                  style: AppTextStyles.h1.copyWith(
                                    fontSize: 30,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            FavoriteButton(
                              kind: FavoriteKind.service,
                              targetId: service.id,
                              name: service.name,
                            ),
                          ],
                        ),
                        if (description.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          SiteProse(description),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SiteSectionTitle(title: l10n.serviceAvailableCompanies),
                  ...offersAsync.when(
                    loading: () => const [AppSkeletonList(count: 2)],
                    error: (_, _) => [
                      AppErrorState(
                        message: l10n.serviceCompaniesLoadFailed,
                        onRetry: () => ref.invalidate(
                          companiesOfferingServiceProvider(service.id),
                        ),
                      ),
                    ],
                    data: (offers) => offers.isEmpty
                        ? [SiteEmptyState(title: l10n.serviceNoCompanies)]
                        : [
                            for (int i = 0; i < offers.length; i++) ...[
                              ServiceOfferCard(
                                service: service,
                                offer: offers[i],
                              ),
                              if (i < offers.length - 1)
                                const SizedBox(height: 16),
                            ],
                          ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
