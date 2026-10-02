import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../technician_actions.dart';
import '../technician_format.dart';
import '../widgets/technician_widgets.dart';
import '../../../../core/localization/l10n_extension.dart';
import '../../../orders/presentation/order_labels.dart';
import '../../../orders/presentation/widgets/order_cancelled_note.dart';

/// Lets the technician move an assigned job forward through
/// Processing -> Out for Delivery -> Completed, once the company has
/// confirmed the order's payment (before that the rules refuse it, so the
/// job only says it is waiting). No payment or reassignment controls —
/// those stay with the company admin.
class TechnicianJobStatusActions extends ConsumerStatefulWidget {
  const TechnicianJobStatusActions({super.key, required this.order});

  final OrderEntity order;

  @override
  ConsumerState<TechnicianJobStatusActions> createState() =>
      _TechnicianJobStatusActionsState();
}

class _TechnicianJobStatusActionsState
    extends ConsumerState<TechnicianJobStatusActions> {
  bool _isBusy = false;

  Future<void> _run(Future<String?> Function() action, String success) async {
    setState(() => _isBusy = true);
    final error = await action();
    if (!mounted) {
      return;
    }
    setState(() => _isBusy = false);
    showAppSnackBar(
      context,
      error ?? success,
      tone: error == null ? AppTone.success : AppTone.error,
    );
  }

  Future<bool> _confirm(String title, String message) {
    return showConfirmationDialog(
      context,
      title: title,
      body: message,
      confirmLabel: context.l10n.commonConfirm,
    );
  }

  String _nextLabel(OrderStatus next) {
    return switch (next) {
      OrderStatus.outForDelivery => context.l10n.adminMarkOutForDelivery,
      OrderStatus.completed => context.l10n.techMarkInstallationCompleted,
      OrderStatus.processing => context.l10n.adminMarkProcessing,
      // Never a next step: only the company cancels an order.
      OrderStatus.cancelled => context.l10n.orderStatusCancelled,
    };
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final actions = ref.read(technicianActionsProvider);
    final next = TechnicianFormat.nextStatus(order);

    return TechnicianSectionCard(
      title: context.l10n.adminJobStatus,
      children: [
        // The company cancelled the order: there is no job to do.
        if (order.isCancelled)
          OrderCancelledNote(order: order, showRefund: false)
        else if (next == null)
          Row(
            children: [
              Icon(Icons.check_circle_rounded, color: context.colors.success),
              const SizedBox(width: AppSpacing.s8),
              Expanded(
                child: Text(
                  context.l10n.techJobCompleted,
                  style: AppTextStyles.bodyStrong,
                ),
              ),
            ],
          )
        // Nothing moves on before the company confirms the payment.
        else if (order.paymentStatus != PaymentStatus.confirmed)
          Row(
            key: const ValueKey('technician-awaiting-payment'),
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.hourglass_top_rounded,
                color: AppTone.warning.accent(context.colors),
              ),
              const SizedBox(width: AppSpacing.s8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.techAwaitingPayment,
                      style: AppTextStyles.bodyStrong,
                    ),
                    const SizedBox(height: AppSpacing.s4),
                    Text(
                      context.l10n.techAwaitingPaymentHint,
                      style: AppTextStyles.caption
                          .copyWith(color: context.colors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          )
        else
          AppButton.primary(
            expand: true,
            icon: Icons.arrow_forward_rounded,
            loading: _isBusy,
            label: _nextLabel(next),
            onPressed: () async {
              final l10n = context.l10n;
              final statusLabel = next.label(l10n);
              final ok = await _confirm(
                l10n.techUpdateJobStatus,
                l10n.techChangeJobBody(order.shortId, statusLabel),
              );
              if (ok) {
                await _run(
                  () => actions.advanceJobStatus(order, next),
                  l10n.techJobMarked(statusLabel),
                );
              }
            },
          ),
      ],
    );
  }
}
