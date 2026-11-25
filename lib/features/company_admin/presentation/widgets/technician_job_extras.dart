import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../job_chat/domain/job_chat.dart';
import '../../../job_chat/presentation/job_chat_screen.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../tech_chat/domain/tech_chat.dart';
import '../../../tech_chat/presentation/tech_chat_screen.dart';
import '../../../technician/presentation/widgets/technician_notes_section.dart';

/// What the company sees of its technician's work on a job: the notes they
/// left (the customer cannot see them), a private conversation with them, and
/// (to read) their conversation with the customer.
/// Shown only once a technician is assigned.
class TechnicianJobExtras extends StatelessWidget {
  const TechnicianJobExtras({super.key, required this.order});

  final OrderEntity order;

  @override
  Widget build(BuildContext context) {
    final technicianId = order.technicianId ?? '';
    if (technicianId.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        const SizedBox(height: AppSpacing.s12),
        JobChatButton(
          orderId: order.id,
          role: JobChatRole.company,
          companyId: order.companyId,
          technicianId: technicianId,
          technicianName: order.technicianName ?? '',
          productName: order.productName,
          label: context.l10n.tjChatWithTechnician,
        ),
        // What the customer and the technician say to each other: read only.
        const SizedBox(height: AppSpacing.s8),
        TechChatButton(
          orderId: order.id,
          viewer: TechChatViewer.company,
          label: context.l10n.tcChatCustomerTechnician,
        ),
        // Empty (nothing shown) until the technician writes something.
        TechnicianNotesSection(order: order),
      ],
    );
  }
}
