import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../technicians/domain/entities/technician.dart';
import '../../../technicians/presentation/technicians_providers.dart';
import '../company_admin_actions.dart';
import '../company_admin_format.dart';
import '../orders/company_order_details_screen.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/order_status_actions.dart';
import '../widgets/status_badge.dart';

class InstallationJobDetailsScreen extends ConsumerWidget {
  const InstallationJobDetailsScreen({
    super.key,
    required this.companyId,
    required this.orderId,
  });

  final String companyId;
  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(companyOrdersStreamProvider(companyId));
    final order = findCompanyOrder(ordersAsync.asData?.value, orderId);

    return Scaffold(
      appBar: AppBar(
        title: Text(order == null ? 'Installation Job' : 'Job #${order.shortId}'),
      ),
      body: order == null
          ? (ordersAsync.isLoading
              ? const Center(child: CircularProgressIndicator())
              : const AdminErrorState(message: 'This job was not found.'))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                AdminSectionCard(
                  title: 'Installation Job',
                  trailing: StatusBadge(
                    label: CompanyAdminFormat.installationJobStatus(order),
                    color:
                        CompanyAdminFormat.orderStatusColor(order.orderStatus),
                  ),
                  children: [
                    AdminInfoRow(label: 'Job / Order Number', value: order.id),
                    AdminInfoRow(label: 'Product', value: order.productName),
                    AdminInfoRow(label: 'Quantity', value: '${order.quantity}'),
                    AdminInfoRow(
                      label: 'Installation Fee',
                      value: CompanyAdminFormat.price(order.installationFee),
                    ),
                    AdminInfoRow(
                      label: 'Order Status',
                      value: order.orderStatus.displayName,
                    ),
                    AdminInfoRow(
                      label: 'Created',
                      value: CompanyAdminFormat.date(order.createdAt),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: 'Customer & Location',
                  children: [
                    AdminInfoRow(
                      label: 'Customer',
                      value: CompanyAdminFormat.customer(order),
                    ),
                    AdminInfoRow(
                      label: 'Contact Phone',
                      value: order.contactPhone,
                    ),
                    AdminInfoRow(
                      label: order.deliveryMethod == DeliveryMethod.delivery
                          ? 'Installation Address'
                          : 'Location',
                      value: order.deliveryMethod == DeliveryMethod.delivery
                          ? order.deliveryAddress
                          : 'Customer pickup — confirm the installation location by phone',
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _TechnicianAssignmentCard(companyId: companyId, order: order),
                const SizedBox(height: 12),
                OrderStatusActions(order: order),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => CompanyOrderDetailsScreen(
                        companyId: companyId,
                        orderId: order.id,
                      ),
                    ),
                  ),
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: const Text('View full order'),
                ),
              ],
            ),
    );
  }
}

/// Lets the company admin assign one of their own technicians to this
/// installation job. The order stays a normal product order; only its
/// technicianId/technicianName fields change.
class _TechnicianAssignmentCard extends ConsumerStatefulWidget {
  const _TechnicianAssignmentCard({
    required this.companyId,
    required this.order,
  });

  final String companyId;
  final OrderEntity order;

  @override
  ConsumerState<_TechnicianAssignmentCard> createState() =>
      _TechnicianAssignmentCardState();
}

class _TechnicianAssignmentCardState
    extends ConsumerState<_TechnicianAssignmentCard> {
  bool _isSaving = false;

  Future<void> _assign(Technician technician) async {
    setState(() => _isSaving = true);
    final error = await ref.read(companyAdminActionsProvider).assignTechnician(
          widget.order,
          technicianId: technician.id,
          technicianName: technician.fullName,
        );
    if (!mounted) {
      return;
    }
    setState(() => _isSaving = false);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(error ?? 'Technician assigned.'),
          backgroundColor: error == null ? null : AppColors.error,
        ),
      );
  }

  Future<void> _pickTechnician(List<Technician> technicians) async {
    final selected = await showDialog<Technician>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: const Text('Assign Technician'),
        children: [
          for (final technician in technicians)
            SimpleDialogOption(
              onPressed: () => Navigator.of(dialogContext).pop(technician),
              child: Text(technician.fullName),
            ),
        ],
      ),
    );
    if (selected != null) {
      await _assign(selected);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final textTheme = Theme.of(context).textTheme;
    final techniciansAsync =
        ref.watch(companyTechniciansStreamProvider(widget.companyId));
    final assignedName = order.technicianName ?? '';

    return AdminSectionCard(
      title: 'Technician',
      children: [
        AdminInfoRow(
          label: 'Assigned to',
          value: assignedName.isEmpty ? 'Not assigned' : assignedName,
        ),
        const SizedBox(height: 10),
        techniciansAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Text(
            'Could not load technicians.',
            style: textTheme.bodySmall,
          ),
          data: (technicians) {
            final active = technicians.where((t) => t.isActive).toList();
            if (active.isEmpty) {
              return Text(
                'Add a technician first to assign this job.',
                style: textTheme.bodySmall,
              );
            }
            return SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _isSaving ? null : () => _pickTechnician(active),
                icon: _isSaving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.engineering_outlined),
                label: Text(
                  assignedName.isEmpty ? 'Assign Technician' : 'Change Technician',
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
