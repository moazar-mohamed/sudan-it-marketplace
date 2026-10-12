import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../job_chat/domain/job_chat.dart';
import '../../../job_chat/presentation/job_chat_screen.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../technician/presentation/widgets/technician_notes_section.dart';

/// What the company sees of its technician's work on a job: the notes they
/// left (the customer cannot see them) and a private conversation with them.
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
        // Empty (nothing shown) until the technician writes something.
        TechnicianNotesSection(order: order),
      ],
    );
  }
}
