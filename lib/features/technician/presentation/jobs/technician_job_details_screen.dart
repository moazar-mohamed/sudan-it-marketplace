import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../location/presentation/location_strings.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../orders/presentation/widgets/order_cancelled_note.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../../../job_chat/domain/job_chat.dart';
import '../../../job_chat/presentation/job_chat_screen.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/phone_number.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../technician_format.dart';
import '../technician_job_helpers.dart';
import '../widgets/technician_notes_section.dart';
import '../widgets/technician_widgets.dart';
import 'technician_job_status_actions.dart';
import '../../../../core/localization/l10n_extension.dart';

OrderEntity? _findJob(List<OrderEntity>? jobs, String orderId) {
  if (jobs == null) {
    return null;
  }
  for (final job in jobs) {
    if (job.id == orderId) {
      return job;
    }
  }
  return null;
}

class TechnicianJobDetailsScreen extends ConsumerWidget {
  const TechnicianJobDetailsScreen({
    super.key,
    required this.technicianId,
    required this.orderId,
  });

  final String technicianId;
  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsAsync = ref.watch(technicianOrdersStreamProvider(technicianId));
    final job = _findJob(jobsAsync.asData?.value, orderId);

    return Scaffold(
      appBar: AppBar(
        title: Text(job == null ? context.l10n.adminJobDetails : context.l10n.adminJobTitleNumber(job.shortId)),
      ),
      body: job == null
          ? (jobsAsync.isLoading
              ? const AppLoadingState()
              : TechnicianErrorState(message: context.l10n.adminJobNotFound))
          : _JobBody(job: job),
      bottomNavigationBar: job == null || job.isCancelled
          ? null
          : AppBottomBar(
              child: TechnicianJobStatusActions(
                order: job,
                companion: _QuickActions(job: job),
              ),
            ),
    );
  }
}

/// Call the customer and talk to the company, beside the main button.
class _QuickActions extends ConsumerWidget {
  const _QuickActions({required this.job});

  final OrderEntity job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton.outlined(
          key: const ValueKey('job-call'),
          tooltip: context.l10n.tjCall,
          icon: const Icon(Icons.phone_outlined),
          onPressed: job.contactPhone.trim().isEmpty
              ? null
              : () => callCustomer(context, job.contactPhone),
        ),
        const SizedBox(width: AppSpacing.s4),
        JobChatButton(
          orderId: job.id,
          role: JobChatRole.technician,
          companyId: job.companyId,
          technicianId: job.technicianId ?? '',
          technicianName: job.technicianName ?? '',
          productName: job.productName,
        ),
      ],
    );
  }
}

class _JobBody extends ConsumerWidget {
  const _JobBody({required this.job});

  final OrderEntity job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final isDelivery = job.deliveryMethod == DeliveryMethod.delivery;
    final address = isDelivery
        ? orderDeliveryLabel(context, job)
        : l10n.adminCustomerPickupConfirm;
    final canCopy = isDelivery && job.deliveryText != null;

    return AppCenteredList(
      children: [
        _ProgressCard(job: job),
        const SizedBox(height: AppSpacing.s12),
        TechnicianSectionCard(
          title: l10n.adminCustomerLocation,
          children: [
            TechnicianInfoRow(
              label: l10n.adminCustomer,
              value: TechnicianFormat.customer(job, l10n),
            ),
            TechnicianInfoRow(
              label: l10n.orderContactPhone,
              value: displayPhone(job.contactPhone),
              valueTextDirection: TextDirection.ltr,
            ),
            TechnicianInfoRow(
              label: isDelivery
                  ? l10n.adminInstallationAddress
                  : l10n.adminLocation,
              value: address,
            ),
            if (canCopy)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: AppButton.text(
                  key: const ValueKey('job-copy-address'),
                  icon: Icons.copy_outlined,
                  label: l10n.tjCopyAddress,
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(text: job.deliveryText!),
                    );
                    if (context.mounted) {
                      showAppSnackBar(context, l10n.tjAddressCopied);
                    }
                  },
                ),
              ),
            // The customer's/order location saved at checkout. The
            // company's own location is intentionally not offered
            // here; a technician sees it only in their Company section.
            const SizedBox(height: AppSpacing.s8),
            OrderLocationButton(
              order: job,
              label: LocationStrings.of(context).openOrderLocation,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.s12),
        TechnicianSectionCard(
          title: l10n.adminInstallationJob,
          trailing: TechnicianStatusBadge(
            label: TechnicianFormat.jobStatusLabel(job, l10n),
            tone: TechnicianFormat.jobStatusTone(job.orderStatus),
          ),
          children: [
            Row(
              children: [
                const AppIconTile(
                  icon: Icons.inventory_2_outlined,
                  size: 44,
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(job.productName, style: AppTextStyles.bodyStrong),
                      Text(
                        '${l10n.adminQuantity}: ${job.quantity} • '
                        '${l10n.orderInstallationFee}: '
                        '${TechnicianFormat.price(job.installationFee)}',
                        style: AppTextStyles.caption
                            .copyWith(color: context.colors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.s8),
            TechnicianInfoRow(
              label: l10n.adminOrderNumber,
              value: job.id,
              valueTextDirection: TextDirection.ltr,
            ),
            TechnicianInfoRow(
              label: l10n.adminCreated,
              value: TechnicianFormat.date(job.createdAt),
              valueTextDirection: TextDirection.ltr,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.s12),
        TechnicianNotesSection(order: job, editable: true),
        if (job.isCancelled) ...[
          const SizedBox(height: AppSpacing.s12),
          TechnicianSectionCard(
            title: l10n.adminJobStatus,
            children: [OrderCancelledNote(order: job, showRefund: false)],
          ),
        ],
      ],
    );
  }
}

/// payment confirmed -> preparing -> on the way -> done, from the order's own
/// payment and delivery state. A pickup job has no "on the way".
class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.job});

  final OrderEntity job;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (job.isCancelled) return const SizedBox.shrink();

    final delivery = job.deliveryMethod == DeliveryMethod.delivery;
    final paid = job.paymentStatus == PaymentStatus.confirmed;
    final labels = [
      l10n.tjStepPaid,
      l10n.tjStepPreparing,
      if (delivery) l10n.tjStepOnTheWay,
      l10n.tjStepDone,
    ];
    // Before the payment is confirmed nothing has started: the first step is
    // the one being waited for.
    var index = 0;
    if (paid) {
      index = switch (job.orderStatus) {
        OrderStatus.processing => 1,
        OrderStatus.outForDelivery => delivery ? 2 : 1,
        OrderStatus.completed => labels.length - 1,
        OrderStatus.cancelled => 0,
      };
    }

    return TechnicianSectionCard(
      title: l10n.tjProgressTitle,
      children: [
        AppStepTracker(
          labels: labels,
          currentIndex: index,
          allDone: job.orderStatus == OrderStatus.completed,
        ),
      ],
    );
  }
}
