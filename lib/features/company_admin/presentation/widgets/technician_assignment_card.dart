import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../technicians/domain/entities/technician.dart';
import '../../../technicians/presentation/technicians_providers.dart';
import '../company_admin_actions.dart';
import 'admin_section_card.dart';
import 'technician_picker_sheet.dart';

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
    final error = await ref
        .read(companyAdminActionsProvider)
        .assignTechnician(
          widget.order,
          technicianId: technician.id,
          technicianName: technician.fullName,
        );
    if (!mounted) {
      return;
    }
    setState(() => _isSaving = false);
    showAppSnackBar(
      context,
      error ?? context.l10n.adminTechnicianAssigned,
      tone: error == null ? AppTone.success : AppTone.error,
    );
  }

  Future<void> _pickTechnician(List<Technician> technicians) async {
    final selected = await showTechnicianPicker(
      context,
      technicians: technicians,
      assignedId: widget.order.technicianId,
    );
    // Choosing the technician who already has the job changes nothing.
    if (selected != null && selected.id != widget.order.technicianId) {
      await _assign(selected);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final techniciansAsync = ref.watch(
      companyTechniciansStreamProvider(widget.companyId),
    );
    final assignedName = order.technicianName ?? '';

    return AdminSectionCard(
      title: context.l10n.adminTechnicianSection,
      children: [
        AdminInfoRow(
          label: context.l10n.adminAssignedTo,
          value: assignedName.isEmpty
              ? context.l10n.adminNotAssigned
              : assignedName,
        ),
        const SizedBox(height: AppSpacing.s8),
        techniciansAsync.when(
          loading: () => const AppLoadingState(),
          error: (_, _) => Text(
            context.l10n.adminTechniciansLoadFailedShort,
            style: AppTextStyles.caption.copyWith(color: AppColors.errorText),
          ),
          data: (technicians) {
            final active = technicians.where((t) => t.isActive).toList();
            if (active.isEmpty) {
              return Text(
                context.l10n.adminAddTechnicianFirst,
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.textSecondary,
                ),
              );
            }
            return AppButton.outlined(
              expand: true,
              icon: Icons.engineering_outlined,
              loading: _isSaving,
              label: assignedName.isEmpty
                  ? context.l10n.adminAssignTechnician
                  : context.l10n.adminChangeTechnician,
              onPressed: () => _pickTechnician(active),
            );
          },
        ),
      ],
    );
  }
}
