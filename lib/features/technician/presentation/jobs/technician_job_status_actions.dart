import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../technician_actions.dart';
import '../technician_format.dart';
import '../widgets/technician_widgets.dart';

/// Lets the technician move an assigned job forward through
/// Processing -> Out for Delivery -> Completed. No payment or reassignment
/// controls — those stay with the company admin.
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
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(error ?? success),
          backgroundColor: error == null ? null : AppColors.error,
        ),
      );
  }

  Future<bool> _confirm(String title, String message) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  String _nextLabel(OrderStatus next) {
    return switch (next) {
      OrderStatus.outForDelivery => 'Mark Out for Delivery',
      OrderStatus.completed => 'Mark Installation Completed',
      OrderStatus.processing => 'Mark Processing',
    };
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final actions = ref.read(technicianActionsProvider);
    final next = TechnicianFormat.nextStatus(order);
    final textTheme = Theme.of(context).textTheme;

    return TechnicianSectionCard(
      title: 'Job Status',
      children: [
        if (next == null)
          Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: AppColors.success),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'This job is completed.',
                  style: textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          )
        else
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isBusy
                  ? null
                  : () async {
                      final ok = await _confirm(
                        'Update job status',
                        'Change job #${order.shortId} to "${next.displayName}"? This cannot be undone.',
                      );
                      if (ok) {
                        await _run(
                          () => actions.advanceJobStatus(order, next),
                          'Job marked ${next.displayName}.',
                        );
                      }
                    },
              icon: _isBusy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.onPrimary,
                      ),
                    )
                  : const Icon(Icons.arrow_forward_rounded),
              label: Text(
                _nextLabel(next),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
      ],
    );
  }
}
