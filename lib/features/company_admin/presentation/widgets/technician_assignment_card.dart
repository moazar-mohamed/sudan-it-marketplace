import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../technicians/domain/entities/technician.dart';
import '../../../technicians/presentation/technicians_providers.dart';
import '../company_admin_actions.dart';
import 'admin_section_card.dart';

/// Lets the company admin assign one of their own technicians to this
/// installation job. The order stays a normal product order; only its
/// technicianId/technicianName fields change.
class TechnicianAssignmentCard extends ConsumerStatefulWidget {
  const TechnicianAssignmentCard({
    super.key,
    required this.companyId,
    required this.order,
  });

  final String companyId;
  final OrderEntity order;

  @override
  ConsumerState<TechnicianAssignmentCard> createState() =>
      _TechnicianAssignmentCardState();
}

class _TechnicianAssignmentCardState
    extends ConsumerState<TechnicianAssignmentCard> {
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
