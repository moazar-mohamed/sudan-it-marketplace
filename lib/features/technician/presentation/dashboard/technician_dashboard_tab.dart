import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../widgets/technician_job_tile.dart';
import '../widgets/technician_widgets.dart';
import '../jobs/technician_job_details_screen.dart';

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
        message: 'Could not load your dashboard.',
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
              'Welcome, $technicianName',
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
                      Text('Total Jobs', style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TechnicianSectionCard(
                    children: [
                      Text('$pending', style: theme.textTheme.headlineMedium),
                      const SizedBox(height: 4),
                      Text('Pending', style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TechnicianSectionCard(
                    children: [
                      Text('$completed', style: theme.textTheme.headlineMedium),
                      const SizedBox(height: 4),
                      Text('Completed', style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Text(
                  'Upcoming Jobs',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: onSelectJobsTab,
                  child: const Text('View all'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (upcoming.isEmpty)
              const TechnicianEmptyState(
                icon: Icons.check_circle_outline,
                message: 'No pending jobs right now.',
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
