import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../widgets/technician_job_tile.dart';
import '../widgets/technician_widgets.dart';
import '../jobs/technician_job_details_screen.dart';
import '../../../../core/localization/l10n_extension.dart';

class TechnicianDashboardTab extends ConsumerWidget {
  const TechnicianDashboardTab({
    super.key,
    required this.technicianId,
    required this.technicianName,
    required this.onSelectJobsTab,
  });

  final String technicianId;
  final String technicianName;
  final VoidCallback onSelectJobsTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsAsync = ref.watch(technicianOrdersStreamProvider(technicianId));
    final theme = Theme.of(context);

    return jobsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => TechnicianErrorState(
        message: context.l10n.techDashboardLoadFailed,
        onRetry: () =>
            ref.invalidate(technicianOrdersStreamProvider(technicianId)),
      ),
      data: (jobs) {
        final pending = jobs
            .where((j) => j.orderStatus != OrderStatus.completed)
            .length;
        final completed = jobs
            .where((j) => j.orderStatus == OrderStatus.completed)
            .length;
        final recent = [...jobs]
          ..sort((a, b) =>
              (b.updatedAt ?? b.createdAt).compareTo(a.updatedAt ?? a.createdAt));
        final upcoming = recent
            .where((j) => j.orderStatus != OrderStatus.completed)
            .take(5)
            .toList();

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            Text(
              context.l10n.techWelcome(technicianName),
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TechnicianSectionCard(
                    children: [
                      Text('${jobs.length}', style: theme.textTheme.headlineMedium),
                      const SizedBox(height: 4),
                      Text(context.l10n.techTotalJobs, style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TechnicianSectionCard(
                    children: [
                      Text('$pending', style: theme.textTheme.headlineMedium),
                      const SizedBox(height: 4),
                      Text(context.l10n.jobStatusPending, style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TechnicianSectionCard(
                    children: [
                      Text('$completed', style: theme.textTheme.headlineMedium),
                      const SizedBox(height: 4),
                      Text(context.l10n.orderStatusCompleted, style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Text(
                  context.l10n.techUpcomingJobs,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: onSelectJobsTab,
                  child: Text(context.l10n.adminViewAll),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (upcoming.isEmpty)
              TechnicianEmptyState(
                icon: Icons.check_circle_outline,
                message: context.l10n.techNoPendingJobs,
              )
            else
              ...upcoming.map(
                (job) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: TechnicianJobTile(
                    order: job,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => TechnicianJobDetailsScreen(
                          technicianId: technicianId,
                          orderId: job.id,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
