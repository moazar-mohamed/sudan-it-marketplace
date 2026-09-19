import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../location/presentation/location_strings.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../technician_format.dart';
import '../widgets/technician_widgets.dart';
import 'technician_job_status_actions.dart';

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
        title: Text(job == null ? 'Job Details' : 'Job #${job.shortId}'),
      ),
      body: job == null
          ? (jobsAsync.isLoading
              ? const Center(child: CircularProgressIndicator())
              : const TechnicianErrorState(message: 'This job was not found.'))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                TechnicianSectionCard(
                  title: 'Installation Job',
                  trailing: TechnicianStatusBadge(
                    label: TechnicianFormat.jobStatusLabel(job),
                    color: TechnicianFormat.jobStatusColor(job.orderStatus),
                  ),
                  children: [
                    TechnicianInfoRow(label: 'Order Number', value: job.id),
                    TechnicianInfoRow(label: 'Product', value: job.productName),
                    TechnicianInfoRow(label: 'Quantity', value: '${job.quantity}'),
                    TechnicianInfoRow(
                      label: 'Installation Fee',
                      value: TechnicianFormat.price(job.installationFee),
                    ),
                    TechnicianInfoRow(
                      label: 'Current Status',
                      value: job.orderStatus.displayName,
                    ),
                    TechnicianInfoRow(
                      label: 'Created',
                      value: TechnicianFormat.date(job.createdAt),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TechnicianSectionCard(
                  title: 'Customer & Location',
                  children: [
                    TechnicianInfoRow(
                      label: 'Customer',
                      value: TechnicianFormat.customer(job),
                    ),
                    TechnicianInfoRow(
                      label: 'Contact Phone',
                      value: job.contactPhone,
                    ),
                    TechnicianInfoRow(
                      label: job.deliveryMethod == DeliveryMethod.delivery
                          ? 'Installation Address'
                          : 'Location',
                      value: job.deliveryMethod == DeliveryMethod.delivery
                          ? orderDeliveryLabel(context, job)
                          : 'Customer pickup — confirm the installation location by phone',
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
