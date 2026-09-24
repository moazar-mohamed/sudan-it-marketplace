import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../widgets/technician_job_tile.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
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

    return jobsAsync.when(
      loading: () => ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: const [AppSkeletonList()],
      ),
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

        Widget stat(String value, String label) => AppCard(
              padding: const EdgeInsets.all(AppSpacing.s12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value, style: AppTextStyles.stat),
                  Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            );

        return AppCenteredList(
          children: [
            Text(context.l10n.techWelcome(technicianName), style: AppTextStyles.h2),
            const SizedBox(height: AppSpacing.s16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: stat('${jobs.length}', context.l10n.techTotalJobs)),
                const SizedBox(width: AppSpacing.s12),
                Expanded(child: stat('$pending', context.l10n.jobStatusPending)),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: stat('$completed', context.l10n.orderStatusCompleted),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.s20),
            SectionHeader(
              title: context.l10n.techUpcomingJobs,
              actionLabel: context.l10n.adminViewAll,
              onAction: onSelectJobsTab,
            ),
            const SizedBox(height: AppSpacing.s8),
            if (upcoming.isEmpty)
              TechnicianEmptyState(
                icon: Icons.check_circle_outline,
                message: context.l10n.techNoPendingJobs,
              )
            else
              ...upcoming.map(
                (job) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.s12),
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
