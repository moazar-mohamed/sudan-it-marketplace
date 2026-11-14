import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../../../technicians/presentation/technicians_providers.dart';
import '../widgets/technician_job_tile.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../technician_format.dart';
import '../technician_job_helpers.dart';
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

  void _open(BuildContext context, OrderEntity job) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TechnicianJobDetailsScreen(
          technicianId: technicianId,
          orderId: job.id,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsAsync = ref.watch(technicianOrdersStreamProvider(technicianId));
    final position = ref.watch(technicianPositionProvider).asData?.value;

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
        final open = jobs.where(isOpenJob).length;
        final completed = jobs
            .where((j) => j.orderStatus == OrderStatus.completed)
            .length;
        final next = nextJob(jobs, position);
        final others = [...jobs.where(isOpenJob)]
          ..removeWhere((j) => j.id == next?.id)
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        final fees = monthInstallationFees(jobs, DateTime.now());

        return AppCenteredList(
          children: [
            _GreetingCard(
              technicianId: technicianId,
              technicianName: technicianName,
              openCount: open,
            ),
            const SizedBox(height: AppSpacing.s16),
            if (next != null) ...[
              _NextJobCard(
                job: next,
                distanceKm: jobDistanceKm(next, position),
                onTap: () => _open(context, next),
              ),
              const SizedBox(height: AppSpacing.s16),
            ],
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _StatTile(
                    value: '${jobs.length}',
                    label: context.l10n.techTotalJobs,
                    tone: AppTone.neutral,
                  ),
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: _StatTile(
                    value: '$open',
                    label: context.l10n.tjStatOpen,
                    tone: AppTone.warning,
                  ),
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: _StatTile(
                    value: '$completed',
                    label: context.l10n.orderStatusCompleted,
                    tone: AppTone.success,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.s12),
            AppCard(
              child: Row(
                children: [
                  const AppIconTile(
                    icon: Icons.payments_outlined,
                    tone: AppTone.success,
                    size: 40,
                  ),
                  const SizedBox(width: AppSpacing.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          context.l10n.tjMonthFees,
                          style: AppTextStyles.caption.copyWith(
                            color: context.colors.textSecondary,
                          ),
                        ),
                        Text(
                          TechnicianFormat.price(fees),
                          textDirection: TextDirection.ltr,
                          style: AppTextStyles.h3,
                        ),
                        Text(
                          context.l10n.tjMonthFeesHint,
                          style: AppTextStyles.labelSmall.copyWith(
                            color: context.colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.s20),
            SectionHeader(
              title: context.l10n.techUpcomingJobs,
              actionLabel: context.l10n.adminViewAll,
              onAction: onSelectJobsTab,
            ),
            const SizedBox(height: AppSpacing.s8),
            if (next == null && others.isEmpty)
              TechnicianEmptyState(
                icon: Icons.check_circle_outline,
                message: context.l10n.techNoPendingJobs,
              )
            else
              ...others.take(5).map(
                    (job) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.s12),
                      child: TechnicianJobTile(
                        order: job,
                        distanceKm: jobDistanceKm(job, position),
                        onTap: () => _open(context, job),
                      ),
                    ),
                  ),
          ],
        );
      },
    );
  }
}

/// The welcome line with the "taking jobs / busy" switch.
class _GreetingCard extends ConsumerStatefulWidget {
  const _GreetingCard({
    required this.technicianId,
    required this.technicianName,
    required this.openCount,
  });

  final String technicianId;
  final String technicianName;
  final int openCount;

  @override
  ConsumerState<_GreetingCard> createState() => _GreetingCardState();
}

class _GreetingCardState extends ConsumerState<_GreetingCard> {
  bool _saving = false;

  Future<void> _toggle(bool available) async {
    final failedMessage = context.l10n.tjAvailabilityFailed;
    setState(() => _saving = true);
    String? error;
    try {
      await ref
          .read(techniciansRepositoryProvider)
          .setAvailability(widget.technicianId, available: available);
    } catch (_) {
      error = failedMessage;
    }
    if (!mounted) return;
    setState(() => _saving = false);
    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final record = ref
        .watch(technicianByUidProvider(widget.technicianId))
        .asData
        ?.value;
    final available = record?.isAvailable ?? true;
    final l10n = context.l10n;

    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.techWelcome(widget.technicianName), style: AppTextStyles.h3),
                const SizedBox(height: AppSpacing.s2),
                Text(
                  widget.openCount == 0
                      ? l10n.tjNoOpenJobs
                      : l10n.tjOpenJobsCount(widget.openCount),
                  style: AppTextStyles.caption
                      .copyWith(color: context.colors.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.s8),
          Column(
            children: [
              Switch(
                value: available,
                onChanged: record == null || _saving ? null : _toggle,
              ),
              Text(
                available ? l10n.tjAvailable : l10n.tjBusy,
                style: AppTextStyles.labelSmall.copyWith(
                  color: available
                      ? context.colors.success
                      : context.colors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// The one job to do next, with its two most useful actions in reach.
class _NextJobCard extends ConsumerWidget {
  const _NextJobCard({
    required this.job,
    required this.distanceKm,
    required this.onTap,
  });

  final OrderEntity job;
  final double? distanceKm;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final place = job.deliveryMethod == DeliveryMethod.delivery
        ? orderDeliveryLabel(context, job)
        : l10n.adminCustomerPickupConfirmShort;
    final waitingPayment = job.paymentStatus != PaymentStatus.confirmed;

    return AppCard(
      onTap: onTap,
      borderColor: context.colors.primary,
      borderWidth: AppBorder.thick,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.tjNextJob,
            style: AppTextStyles.captionStrong
                .copyWith(color: context.colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.s4),
          Text(job.productName, style: AppTextStyles.h3),
          const SizedBox(height: AppSpacing.s4),
          Text(
            '${TechnicianFormat.customer(job, l10n)} • $place'
            '${distanceKm == null ? '' : ' • ${l10n.tjDistanceKm(formatKm(distanceKm!))}'}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.caption
                .copyWith(color: context.colors.textSecondary),
          ),
          if (waitingPayment) ...[
            const SizedBox(height: AppSpacing.s8),
            StatusChip(label: l10n.tjAwaitingPaymentTag, tone: AppTone.warning),
          ],
          const SizedBox(height: AppSpacing.s12),
          Row(
            children: [
              if (jobHasDirections(job)) ...[
                Expanded(
                  child: AppButton.primary(
                    size: AppButtonSize.medium,
                    icon: Icons.navigation_outlined,
                    label: l10n.tjNavigate,
                    onPressed: () async {
                      final opened = await openJobDirections(ref, job);
                      if (!opened && context.mounted) showMapsFailed(context);
                    },
                  ),
                ),
                const SizedBox(width: AppSpacing.s8),
              ],
              Expanded(
                child: AppButton.outlined(
                  size: AppButtonSize.medium,
                  icon: Icons.phone_outlined,
                  label: l10n.tjCall,
                  onPressed: job.contactPhone.trim().isEmpty
                      ? null
                      : () => callCustomer(context, job.contactPhone),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.value,
    required this.label,
    required this.tone,
  });

  final String value;
  final String label;
  final AppTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final neutral = tone == AppTone.neutral;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s12),
      decoration: BoxDecoration(
        color: tone.background(colors),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: AppTextStyles.stat.copyWith(
              color: neutral ? colors.textPrimary : tone.foreground(colors),
            ),
          ),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.caption.copyWith(
              color: neutral ? colors.textSecondary : tone.foreground(colors),
            ),
          ),
        ],
      ),
    );
  }
}
