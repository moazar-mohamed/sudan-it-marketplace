import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../location/presentation/location_strings.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../../../technicians/domain/entities/technician.dart';
import '../../../technicians/presentation/technicians_providers.dart';
import '../company_admin_actions.dart';
import '../company_admin_format.dart';
import '../orders/company_order_details_screen.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/order_status_actions.dart';
import '../widgets/status_badge.dart';
import '../../../../core/localization/l10n_extension.dart';
import '../../../orders/presentation/order_labels.dart';

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
        title: Text(order == null ? context.l10n.adminInstallationJob : context.l10n.adminJobTitleNumber(order.shortId)),
      ),
      body: order == null
          ? (ordersAsync.isLoading
              ? const Center(child: CircularProgressIndicator())
              : AdminErrorState(message: context.l10n.adminJobNotFound))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                AdminSectionCard(
                  title: context.l10n.adminInstallationJob,
                  trailing: StatusBadge(
                    label: CompanyAdminFormat.installationJobStatus(order, context.l10n),
                    color:
                        CompanyAdminFormat.orderStatusColor(order.orderStatus),
                  ),
                  children: [
                    AdminInfoRow(label: context.l10n.adminJobOrderNumber, value: order.id),
                    AdminInfoRow(label: context.l10n.adminProduct, value: order.productName),
                    AdminInfoRow(label: context.l10n.adminQuantity, value: '${order.quantity}'),
                    AdminInfoRow(
                      label: context.l10n.orderInstallationFee,
                      value: CompanyAdminFormat.price(order.installationFee),
                    ),
                    AdminInfoRow(
                      label: context.l10n.orderOrderStatus,
                      value: order.orderStatus.label(context.l10n),
                    ),
                    AdminInfoRow(
                      label: context.l10n.adminCreated,
                      value: CompanyAdminFormat.date(order.createdAt),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: context.l10n.adminCustomerLocation,
                  children: [
                    AdminInfoRow(
                      label: context.l10n.adminCustomer,
                      value: CompanyAdminFormat.customer(order, context.l10n),
                    ),
                    AdminInfoRow(
                      label: context.l10n.orderContactPhone,
                      value: order.contactPhone,
                    ),
                    AdminInfoRow(
                      label: order.deliveryMethod == DeliveryMethod.delivery
                          ? context.l10n.adminInstallationAddress
                          : context.l10n.adminLocation,
                      value: order.deliveryMethod == DeliveryMethod.delivery
                          ? orderDeliveryLabel(context, order)
                          : context.l10n.adminCustomerPickupConfirm,
                    ),
                    const SizedBox(height: 8),
                    OrderLocationButton(
                      order: order,
                      label: LocationStrings.of(context).openDeliveryLocation,
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
                  label: Text(context.l10n.adminViewFullOrder),
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
          content: Text(error ?? context.l10n.adminTechnicianAssigned),
          backgroundColor: error == null ? null : AppColors.error,
        ),
      );
  }

  Future<void> _pickTechnician(List<Technician> technicians) async {
    final selected = await showDialog<Technician>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: Text(context.l10n.adminAssignTechnician),
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
      title: context.l10n.adminTechnicianSection,
      children: [
        AdminInfoRow(
          label: context.l10n.adminAssignedTo,
          value: assignedName.isEmpty ? context.l10n.adminNotAssigned : assignedName,
        ),
        const SizedBox(height: 10),
        techniciansAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => Text(
            context.l10n.adminTechniciansLoadFailedShort,
            style: textTheme.bodySmall,
          ),
          data: (technicians) {
            final active = technicians.where((t) => t.isActive).toList();
            if (active.isEmpty) {
              return Text(
                context.l10n.adminAddTechnicianFirst,
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
                  assignedName.isEmpty ? context.l10n.adminAssignTechnician : context.l10n.adminChangeTechnician,
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
