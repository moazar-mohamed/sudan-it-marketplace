import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../company_admin_actions.dart';
import '../company_admin_format.dart';
import 'admin_section_card.dart';
import '../../../../core/localization/l10n_extension.dart';
import '../../../orders/presentation/order_labels.dart';

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
      OrderStatus.completed => widget.order.installationSelected
          ? context.l10n.adminMarkCompletedInstalled
          : context.l10n.adminMarkCompleted,
      OrderStatus.processing => context.l10n.adminMarkProcessing,
    };
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final actions = ref.read(companyAdminActionsProvider);
    final next = CompanyAdminFormat.nextStatus(order);
    final paymentConfirmed = order.paymentStatus == PaymentStatus.confirmed;

    return AdminSectionCard(
      title: context.l10n.adminManageOrder,
      children: [
        if (!paymentConfirmed) ...[
          Text(
            context.l10n.adminVerifyReceipt,
            style: AppTextStyles.caption
                .copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.s12),
          AppButton.outlined(
              expand: true,
              icon: Icons.verified_outlined,
              label: context.l10n.adminConfirmPaymentButton,
              onPressed: _isBusy
                  ? null
                  : () async {
                      final l10n = context.l10n;
                      final ok = await _confirm(
                        l10n.adminConfirmPaymentTitle,
                        l10n.adminConfirmPaymentBody(order.shortId),
                      );
                      if (ok) {
                        await _run(
                          () => actions.confirmPayment(order),
                          l10n.adminPaymentConfirmed,
                        );
                      }
                    },
          ),
          const SizedBox(height: AppSpacing.s12),
        ],
        if (next == null)
          Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: AppColors.success),
              const SizedBox(width: AppSpacing.s8),
              Expanded(
                child: Text(
                  context.l10n.adminOrderCompleted,
                  style: AppTextStyles.bodyStrong,
                ),
              ),
            ],
          )
        else ...[
          if (order.installationSelected && next == OrderStatus.completed)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s12),
              child: Text(
                context.l10n.adminMarkCompletedHint,
                style: AppTextStyles.caption
                    .copyWith(color: AppColors.textSecondary),
              ),
            ),
          AppButton.primary(
              expand: true,
              icon: Icons.arrow_forward_rounded,
              loading: _isBusy,
              label: _nextLabel(next),
              onPressed: !paymentConfirmed

                  ? null
                  : () async {
                      final l10n = context.l10n;
                      final statusLabel = next.label(l10n);
                      final ok = await _confirm(
                        l10n.adminUpdateOrderStatus,
                        l10n.adminChangeOrderStatusBody(
                          order.shortId,
                          statusLabel,
                        ),
                      );
                      if (ok) {
                        await _run(
                          () => actions.advanceOrderStatus(order, next),
                          l10n.adminOrderMarked(statusLabel),
                        );
                      }
                    },
          ),
        ],
      ],
    );
  }
}
