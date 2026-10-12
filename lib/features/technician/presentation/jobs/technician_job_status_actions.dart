import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../technician_actions.dart';
import '../technician_format.dart';
import '../../../../core/localization/l10n_extension.dart';
import '../../../orders/presentation/order_labels.dart';
import '../../../orders/presentation/widgets/order_cancelled_note.dart';
import '../../domain/technician_note.dart';

/// Lets the technician move an assigned job forward through
/// Processing -> Out for Delivery -> Completed, once the company has
/// confirmed the order's payment (before that the rules refuse it, so the
/// job only says it is waiting). No payment or reassignment controls —
/// those stay with the company admin.
///
/// Used as the job screen's bottom bar: [companion] is the row of quick
/// actions (call, chat) shown beside the main button.
class TechnicianJobStatusActions extends ConsumerStatefulWidget {
  const TechnicianJobStatusActions({
    super.key,
    required this.order,
    this.companion,
  });

  final OrderEntity order;
  final Widget? companion;

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

  Future<void> _advance(OrderStatus next) async {
    final order = widget.order;
    final actions = ref.read(technicianActionsProvider);
    final l10n = context.l10n;
    final statusLabel = next.label(l10n);

    if (next == OrderStatus.completed) {
      // Finishing is the step that cannot be taken back: a short checklist
      // and an optional remark for the company, instead of a plain "sure?".
      final result = await showModalBottomSheet<_FinishResult>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => _FinishSheet(order: order),
      );
      if (result == null || !mounted) return;
      await _run(
        () => actions.finishJob(order, note: result.note),
        l10n.techJobMarked(statusLabel),
      );
      return;
    }

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
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final next = TechnicianFormat.nextStatus(order);
    final companion = widget.companion;

    Widget withCompanion(Widget main) {
      if (companion == null) return main;
      return Row(
        children: [
          companion,
          const SizedBox(width: AppSpacing.s8),
          Expanded(child: main),
        ],
      );
    }

    // The company cancelled the order: there is no job to do.
    if (order.isCancelled) {
      return OrderCancelledNote(order: order, showRefund: false);
    }
    if (next == null) {
      return withCompanion(
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
        ),
      );
    }
    // Nothing moves on before the company confirms the payment.
    if (order.paymentStatus != PaymentStatus.confirmed) {
      return withCompanion(
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
                // A bar must size to its content: the default fills the
                // screen's height in a bottom bar.
                mainAxisSize: MainAxisSize.min,
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
        ),
      );
    }
    return withCompanion(
      AppButton.primary(
        expand: true,
        icon: next == OrderStatus.completed
            ? Icons.check_rounded
            : Icons.arrow_forward_rounded,
        loading: _isBusy,
        label: _nextLabel(next),
        onPressed: () => _advance(next),
      ),
    );
  }
}

class _FinishResult {
  const _FinishResult(this.note);

  final String note;
}

/// The three things to have done before a job is closed, and a remark for
/// the company. Confirming needs all three ticked.
class _FinishSheet extends StatefulWidget {
  const _FinishSheet({required this.order});

  final OrderEntity order;

  @override
  State<_FinishSheet> createState() => _FinishSheetState();
}

class _FinishSheetState extends State<_FinishSheet> {
  final _note = TextEditingController();
  final _checked = <int>{};
  bool _showRequired = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _confirm() {
    if (_checked.length < 3) {
      setState(() => _showRequired = true);
      return;
    }
    Navigator.of(context).pop(_FinishResult(_note.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final items = [
      l10n.tjCheckInstalled,
      l10n.tjCheckExplained,
      l10n.tjCheckHandedOver,
    ];

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.s16,
        0,
        AppSpacing.s16,
        MediaQuery.viewInsetsOf(context).bottom + AppSpacing.s16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.tjFinishTitle(widget.order.shortId),
              style: AppTextStyles.h3,
            ),
            const SizedBox(height: AppSpacing.s8),
            for (var i = 0; i < items.length; i++)
              CheckboxListTile(
                key: ValueKey('finish-check-$i'),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: _checked.contains(i),
                title: Text(items[i], style: AppTextStyles.body),
                onChanged: (value) => setState(() {
                  if (value ?? false) {
                    _checked.add(i);
                  } else {
                    _checked.remove(i);
                  }
                }),
              ),
            if (_showRequired && _checked.length < 3)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.s8),
                child: Text(
                  l10n.tjFinishChecklistRequired,
                  style: AppTextStyles.caption
                      .copyWith(color: context.colors.errorText),
                ),
              ),
            const SizedBox(height: AppSpacing.s8),
            TextField(
              key: const ValueKey('finish-note'),
              controller: _note,
              minLines: 2,
              maxLines: 4,
              maxLength: TechnicianNote.maxLength,
              decoration: InputDecoration(hintText: l10n.tjFinishNoteHint),
            ),
            const SizedBox(height: AppSpacing.s8),
            Row(
              children: [
                Expanded(
                  child: AppButton.outlined(
                    label: l10n.commonCancel,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  flex: 2,
                  child: AppButton.primary(
                    key: const ValueKey('finish-confirm'),
                    icon: Icons.check_rounded,
                    label: l10n.tjFinishConfirm,
                    onPressed: _confirm,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
