import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/order_entity.dart';
import '../order_labels.dart';

/// What happened to a cancelled order: why and when. The company
/// ([forCompany]) also sees whether the order's stock went back. The customer
/// and the company are told how the money comes back (outside the app) when
/// [showRefund] is true; the technician, who never handles payments, is not.
class OrderCancelledNote extends StatelessWidget {
  const OrderCancelledNote({
    super.key,
    required this.order,
    this.forCompany = false,
    this.showRefund = true,
  });

  final OrderEntity order;
  final bool forCompany;
  final bool showRefund;

  static String _date(DateTime value) {
    final local = value.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${local.year}-${two(local.month)}-${two(local.day)} '
        '${two(local.hour)}:${two(local.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final reason = order.cancelReason;
    final when = order.cancelledAt;
    final paymentConfirmed = order.paymentStatus == PaymentStatus.confirmed;
    // The out-of-stock reason already says that the money goes back.
    final refund = !showRefund
        ? null
        : paymentConfirmed
            ? (forCompany
                ? l10n.adminCancelledRefundConfirmed
                : l10n.orderCancelledRefundConfirmed)
            : reason == OrderCancelReason.outOfStock
                ? null
                : (forCompany
                    ? l10n.adminCancelledRefundIfPaid
                    : l10n.orderCancelledRefundIfPaid);
    final lines = [
      if (reason != null) reason.label(l10n),
      if (when != null) l10n.orderCancelledOn(_date(when)),
      if (forCompany)
        order.stockReleased
            ? l10n.adminCancelStockReturned(order.quantity)
            : l10n.adminCancelStockNotReturned,
      ?refund,
    ];
    return Row(
      key: const ValueKey('order-cancelled-note'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.cancel_rounded, color: colors.error),
        const SizedBox(width: AppSpacing.s8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.orderCancelledTitle, style: AppTextStyles.bodyStrong),
              for (final line in lines) ...[
                const SizedBox(height: AppSpacing.s4),
                Text(
                  line,
                  style: AppTextStyles.caption
                      .copyWith(color: colors.textSecondary),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
