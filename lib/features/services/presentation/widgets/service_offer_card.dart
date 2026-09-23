import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../companies/domain/entities/company.dart';
import '../../../company_services/presentation/company_service_providers.dart';
import '../../../service_requests/presentation/service_request_form_screen.dart';
import '../../../service_requests/presentation/service_request_labels.dart';
import '../../domain/entities/catalog_service.dart';

/// A company that offers the service, with the company's own price (shown
/// ONLY when the company set one — no placeholder otherwise) and note, and
/// the action to request the service from it.
class ServiceOfferCard extends StatelessWidget {
  const ServiceOfferCard({
    super.key,
    required this.service,
    required this.offer,
  });

  final CatalogService service;
  final ServiceOffer offer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;
    final company = offer.company;
    final price = offer.offer.price;
    final note = offer.offer.noteText;
    final city = company.city?.trim() ?? '';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: colorScheme.onSurface.withValues(alpha: 0.08),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _CompanyLogo(company: company),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      company.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.star_rounded,
                          color: Colors.amber,
                          size: 16,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          company.rating.toStringAsFixed(1),
                          style: textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (city.isNotEmpty) ...[
                          const SizedBox(width: 10),
                          Icon(
                            Icons.location_on_outlined,
                            size: 15,
                            color: colorScheme.onSurface.withValues(alpha: 0.5),
                          ),
                          const SizedBox(width: 2),
                          Flexible(
                            child: Text(
                              city,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurface
                                    .withValues(alpha: 0.6),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              if (price != null) ...[
                const SizedBox(width: 8),
                Text(
                  formatServicePrice(price),
                  style: textTheme.titleSmall?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ],
          ),
          if (note != null) ...[
            const SizedBox(height: 10),
            Text(
              note,
              style: textTheme.bodySmall?.copyWith(
                height: 1.45,
                color: colorScheme.onSurface.withValues(alpha: 0.75),
              ),
            ),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              icon: const Icon(Icons.send_outlined, size: 18),
              label: Text(context.l10n.serviceRequestAction),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ServiceRequestFormScreen(
                    service: service,
                    offer: offer.offer,
                    company: company,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CompanyLogo extends StatelessWidget {
  const _CompanyLogo({required this.company});

  final Company company;

  @override
  Widget build(BuildContext context) {
    final fallback = Center(
      child: Text(
        company.name.isNotEmpty ? company.name.substring(0, 1) : 'C',
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
    final logoUrl = company.logoUrl ?? '';
    return Container(
      width: 44,
      height: 44,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: logoUrl.isEmpty
          ? fallback
          : Image.network(
              logoUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => fallback,
            ),
    );
  }
}
