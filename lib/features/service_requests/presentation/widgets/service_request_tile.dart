import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../company_admin/presentation/widgets/status_badge.dart';
import '../../domain/entities/service_request.dart';
import '../service_request_details_screen.dart';
import '../service_request_labels.dart';

/// A service request in a list. The customer sees the company; the company
/// ([asCompany]) sees the customer.
class ServiceRequestTile extends StatelessWidget {
  const ServiceRequestTile({
    super.key,
    required this.request,
    required this.asCompany,
  });

  final ServiceRequest request;
  final bool asCompany;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textTheme = theme.textTheme;
    final colorScheme = theme.colorScheme;
    final counterpart = asCompany
        ? (request.customerName.trim().isEmpty
            ? context.l10n.chatCustomerFallback
            : request.customerName.trim())
        : request.companyName;
    final price = request.price;

    return Material(
      color: colorScheme.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ServiceRequestDetailsScreen(
              requestId: request.id,
              asCompany: asCompany,
            ),
          ),
        ),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
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
                  Expanded(
                    child: Text(
                      request.serviceName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  StatusBadge(
                    label: request.status.label(context.l10n),
                    color: request.status.color,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                counterpart,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.bodyMedium,
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '#${request.shortId} · ${formatServiceDate(request.createdAt)}',
                      style: textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurface.withValues(alpha: 0.55),
                      ),
                    ),
                  ),
                  if (price != null)
                    Text(
                      formatServicePrice(price),
                      style: textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colorScheme.primary,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
