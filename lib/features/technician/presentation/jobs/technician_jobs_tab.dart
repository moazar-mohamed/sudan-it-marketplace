import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/presentation/orders_providers.dart';
import '../widgets/technician_job_tile.dart';
import '../widgets/technician_widgets.dart';
import 'technician_job_details_screen.dart';

/// Installation jobs assigned to the signed-in technician.
class TechnicianJobsTab extends ConsumerWidget {
  const TechnicianJobsTab({super.key, required this.technicianId});

  final String technicianId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsAsync = ref.watch(technicianOrdersStreamProvider(technicianId));

    return jobsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => TechnicianErrorState(
        message: 'Could not load your jobs.',
        onRetry: () =>
            ref.invalidate(technicianOrdersStreamProvider(technicianId)),
      ),
      data: (jobs) {
        if (jobs.isEmpty) {
          return ListView(
            children: const [
              TechnicianEmptyState(
                icon: Icons.handyman_outlined,
                message: 'No installation jobs assigned to you yet.',
              ),
            ],
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          itemCount: jobs.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) => TechnicianJobTile(
            order: jobs[index],
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => TechnicianJobDetailsScreen(
                  technicianId: technicianId,
                  orderId: jobs[index].id,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
