import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../categories/presentation/category_providers.dart';
import '../../company_services/presentation/company_service_providers.dart';
import '../domain/entities/catalog_service.dart';
import 'widgets/service_offer_card.dart';

/// A catalogue service and the active companies a customer can request it
/// from, each with its own price (only when one is set) and note.
class ServiceDetailsScreen extends ConsumerWidget {
  const ServiceDetailsScreen({super.key, required this.service});

  final CatalogService service;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offersAsync = ref.watch(serviceOffersProvider(service.id));
    final categoryName =
        ref.watch(categoryNamesProvider)[service.categoryId]?.trim() ?? '';
    final description = service.description.trim();
    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.serviceDetailsTitle)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: AppSize.readingMax),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(service.name, style: AppTextStyles.h1),
                  if (categoryName.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.s8),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: StatusChip(
                        label: categoryName,
                        tone: AppTone.brand,
                        showDot: false,
                      ),
                    ),
                  ],
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.s12),
                    Text(description, style: AppTextStyles.body),
                  ],
                  const SizedBox(height: AppSpacing.s24),
                  Text(
                    context.l10n.serviceAvailableCompanies,
                    style: AppTextStyles.h3,
                  ),
                  const SizedBox(height: AppSpacing.s12),
                  ...offersAsync.when(
                    loading: () => const [AppSkeletonList(count: 2)],
                    error: (_, _) => [
                      AppErrorState(
                        message: context.l10n.serviceCompaniesLoadFailed,
                        onRetry: () => ref.invalidate(
                          companiesOfferingServiceProvider(service.id),
                        ),
                      ),
                    ],
                    data: (offers) => offers.isEmpty
                        ? [
                            AppEmptyState(
                              icon: Icons.business_outlined,
                              message: context.l10n.serviceNoCompanies,
                            ),
                          ]
                        : [
                            for (int i = 0; i < offers.length; i++) ...[
                              ServiceOfferCard(
                                service: service,
                                offer: offers[i],
                              ),
                              if (i < offers.length - 1)
                                const SizedBox(height: AppSpacing.s12),
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
