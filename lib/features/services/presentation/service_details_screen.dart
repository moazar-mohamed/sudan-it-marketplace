import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
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
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final offersAsync = ref.watch(serviceOffersProvider(service.id));
    final categoryName =
        ref.watch(categoryNamesProvider)[service.categoryId]?.trim() ?? '';
    final description = service.description.trim();

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.serviceDetailsTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Text(
            service.name,
            style: textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          if (categoryName.isNotEmpty) ...[
            const SizedBox(height: 6),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Chip(
                label: Text(categoryName),
                visualDensity: VisualDensity.compact,
                side: BorderSide.none,
                backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                labelStyle: textTheme.labelMedium?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
          if (description.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              description,
              style: textTheme.bodyMedium?.copyWith(
                height: 1.5,
                color: colorScheme.onSurface.withValues(alpha: 0.8),
              ),
            ),
          ],
          const SizedBox(height: 24),
          Text(
            context.l10n.serviceAvailableCompanies,
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          ...offersAsync.when(
            loading: () => const [
              Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator()),
              ),
            ],
            error: (_, _) => [
              _Message(text: context.l10n.serviceCompaniesLoadFailed),
              Center(
                child: OutlinedButton(
                  onPressed: () => ref.invalidate(
                    companiesOfferingServiceProvider(service.id),
                  ),
                  child: Text(context.l10n.commonRetry),
                ),
              ),
            ],
            data: (offers) => offers.isEmpty
                ? [_Message(text: context.l10n.serviceNoCompanies)]
                : [
                    for (int i = 0; i < offers.length; i++) ...[
                      ServiceOfferCard(service: service, offer: offers[i]),
                      if (i < offers.length - 1) const SizedBox(height: 12),
                    ],
                  ],
          ),
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.6),
            ),
      ),
    );
  }
}
