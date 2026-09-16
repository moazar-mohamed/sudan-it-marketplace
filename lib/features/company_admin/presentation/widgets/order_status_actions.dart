import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../company_admin_actions.dart';
import '../company_admin_format.dart';
import 'admin_section_card.dart';

/// Payment confirmation and the Processing -> Out for Delivery -> Completed
/// progression for a single product order.
class OrderStatusActions extends ConsumerStatefulWidget {
  const OrderStatusActions({super.key, required this.order});

  final OrderEntity order;

  @override
  ConsumerState<OrderStatusActions> createState() => _OrderStatusActionsState();
}

class _OrderStatusActionsState extends ConsumerState<OrderStatusActions> {
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
      OrderStatus.completed => widget.order.installationSelected
          ? 'Mark Completed (Installed)'
          : 'Mark Completed',
      OrderStatus.processing => 'Mark Processing',
    };
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final actions = ref.read(companyAdminActionsProvider);
    final next = CompanyAdminFormat.nextStatus(order);
    final paymentConfirmed = order.paymentStatus == PaymentStatus.confirmed;
    final textTheme = Theme.of(context).textTheme;

    return AdminSectionCard(
      title: 'Manage Order',
      children: [
        if (!paymentConfirmed) ...[
          Text(
            'Verify the transfer receipt before processing this order.',
            style: textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _isBusy
                  ? null
                  : () async {
                      final ok = await _confirm(
                        'Confirm payment',
                        'Mark the payment for order #${order.shortId} as confirmed?',
                      );
                      if (ok) {
                        await _run(
                          () => actions.confirmPayment(order),
                          'Payment confirmed.',
                        );
                      }
                    },
              icon: const Icon(Icons.verified_outlined),
              label: const Text('Confirm Payment'),
            ),
          ),
          const SizedBox(height: 10),
        ],
        if (next == null)
          Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: AppColors.success),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'This order is completed.',
                  style: textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          )
        else ...[
          if (order.installationSelected && next == OrderStatus.completed)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                'Mark completed once the technician has finished the installation.',
                style: textTheme.bodySmall,
              ),
            ),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: (_isBusy || !paymentConfirmed)
                  ? null
                  : () async {
                      final ok = await _confirm(
                        'Update order status',
                        'Change order #${order.shortId} to "${next.displayName}"? This cannot be undone.',
                      );
                      if (ok) {
                        await _run(
                          () => actions.advanceOrderStatus(order, next),
                          'Order marked ${next.displayName}.',
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
      ],
    );
  }
}
