import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../location/presentation/location_strings.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../technician_format.dart';
import '../widgets/technician_widgets.dart';
import 'technician_job_status_actions.dart';
import '../../../../core/localization/l10n_extension.dart';
import '../../../orders/presentation/order_labels.dart';

OrderEntity? _findJob(List<OrderEntity>? jobs, String orderId) {
  if (jobs == null) {
    return null;
  }
  for (final job in jobs) {
    if (job.id == orderId) {
      return job;
    }
  }
  return null;
}

class TechnicianJobDetailsScreen extends ConsumerWidget {
  const TechnicianJobDetailsScreen({
    super.key,
    required this.technicianId,
    required this.orderId,
  });

  final String technicianId;
  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsAsync = ref.watch(technicianOrdersStreamProvider(technicianId));
    final job = _findJob(jobsAsync.asData?.value, orderId);

    return Scaffold(
      appBar: AppBar(
        title: Text(job == null ? context.l10n.adminJobDetails : context.l10n.adminJobTitleNumber(job.shortId)),
      ),
      body: job == null
          ? (jobsAsync.isLoading
              ? const AppLoadingState()
              : TechnicianErrorState(message: context.l10n.adminJobNotFound))
          : AppCenteredList(
              children: [
                TechnicianSectionCard(
                  title: context.l10n.adminInstallationJob,
                  trailing: TechnicianStatusBadge(
                    label: TechnicianFormat.jobStatusLabel(job, context.l10n),
                    tone: TechnicianFormat.jobStatusTone(job.orderStatus),
                  ),
                  children: [
                    TechnicianInfoRow(label: context.l10n.adminOrderNumber, value: job.id, valueTextDirection: TextDirection.ltr),
                    TechnicianInfoRow(label: context.l10n.adminProduct, value: job.productName),
                    TechnicianInfoRow(label: context.l10n.adminQuantity, value: '${job.quantity}'),
                    TechnicianInfoRow(
                      label: context.l10n.orderInstallationFee,
                      value: TechnicianFormat.price(job.installationFee),
                    ),
                    TechnicianInfoRow(
                      label: context.l10n.adminCurrentStatus,
                      value: job.orderStatus.label(context.l10n),
                    ),
                    TechnicianInfoRow(
                      label: context.l10n.adminCreated,
                      value: TechnicianFormat.date(job.createdAt),
                      valueTextDirection: TextDirection.ltr,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TechnicianSectionCard(
                  title: context.l10n.adminCustomerLocation,
                  children: [
                    TechnicianInfoRow(
                      label: context.l10n.adminCustomer,
                      value: TechnicianFormat.customer(job, context.l10n),
                    ),
                    TechnicianInfoRow(
                      label: context.l10n.orderContactPhone,
                      value: job.contactPhone,
                      valueTextDirection: TextDirection.ltr,
                    ),
                    TechnicianInfoRow(
                      label: job.deliveryMethod == DeliveryMethod.delivery
                          ? context.l10n.adminInstallationAddress
                          : context.l10n.adminLocation,
                      value: job.deliveryMethod == DeliveryMethod.delivery
                          ? orderDeliveryLabel(context, job)
                          : context.l10n.adminCustomerPickupConfirm,
                    ),
                    // The customer's/order location saved at checkout. The
                    // company's own location is intentionally not offered
                    // here; a technician sees it only in their Company section.
                    const SizedBox(height: 8),
                    OrderLocationButton(
                      order: job,
                      label: LocationStrings.of(context).openOrderLocation,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TechnicianJobStatusActions(order: job),
              ],
            ),
    );
  }
}
