import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
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
    final counterpart = asCompany
        ? (request.customerName.trim().isEmpty
            ? context.l10n.chatCustomerFallback
            : request.customerName.trim())
        : request.companyName;
    final price = request.price;

    return AppCard(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ServiceRequestDetailsScreen(
            requestId: request.id,
            asCompany: asCompany,
          ),
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
                  style: AppTextStyles.bodyStrong,
                ),
              ),
              const SizedBox(width: AppSpacing.s8),
              Flexible(
                child: StatusChip(
                  label: request.status.label(context.l10n),
                  tone: request.status.tone,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s4),
          Text(
            counterpart,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.body,
          ),
          const SizedBox(height: AppSpacing.s4),
          Row(
            children: [
              Expanded(
                // The code and date stay left-to-right but sit at the start
                // of the row, away from the price, in Arabic too.
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Text(
                    '#${request.shortId} · ${formatServiceDate(request.createdAt)}',
                    textDirection: TextDirection.ltr,
                    style: AppTextStyles.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                ),
              ),
              // Only a price the company actually set is shown.
              if (price != null)
                Text(
                  formatServicePrice(price),
                  style: AppTextStyles.captionStrong
                      .copyWith(color: AppColors.textBrand),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
