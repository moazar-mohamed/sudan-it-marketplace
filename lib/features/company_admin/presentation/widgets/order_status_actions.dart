import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../products/presentation/products_providers.dart';
import '../company_admin_actions.dart';
import '../company_admin_format.dart';
import 'admin_section_card.dart';
import '../../../../core/localization/l10n_extension.dart';
import '../../../orders/presentation/order_labels.dart';
import '../../../orders/presentation/widgets/order_cancelled_note.dart';

/// Payment confirmation, the Processing -> Out for Delivery -> Completed
/// progression and cancellation for a single product order.
///
/// Confirming the payment is what takes the order's stock, so nothing moves
/// on before it. While the payment waits, the order's product is checked
/// against the order: when it can no longer cover it, the company is told so
/// and may cancel the order as out of stock. The company may cancel while the
/// order is Processing, before or after the payment is confirmed; any refund
/// happens outside the app.
class OrderStatusActions extends ConsumerStatefulWidget {
  const OrderStatusActions({super.key, required this.order});

  final OrderEntity order;

  @override
  ConsumerState<OrderStatusActions> createState() => _OrderStatusActionsState();
}

/// Whether the order's product can still cover an order whose payment waits,
/// as the rules judge it: the product must still be this company's and have
/// at least the order's quantity.
class _StockCover {
  const _StockCover({required this.productGone, required this.available});

  final bool productGone;
  final int available;

  bool covers(OrderEntity order) =>
      !productGone && available >= order.quantity;
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
      // Never a next step: only a cancellation makes an order cancelled.
      OrderStatus.cancelled => context.l10n.orderStatusCancelled,
    };
  }

  /// The product of an order whose payment waits, from the company's live
  /// catalogue; null while it loads (or cannot be read): then nothing is
  /// claimed, and confirming tells the truth if the stock is short.
  _StockCover? _stockCover(OrderEntity order) {
    final products = ref
        .watch(companyProductsStreamProvider(order.companyId))
        .asData
        ?.value;
    if (products == null) return null;
    for (final product in products) {
      if (product.id == order.productId &&
          product.companyId == order.companyId) {
        return _StockCover(productGone: false, available: product.stockCount);
      }
    }
    return const _StockCover(productGone: true, available: 0);
  }

  /// What cancelling by hand does to the stock and the money.
  String _cancelBody(AppLocalizations l10n, OrderEntity order) {
    final amount = CompanyAdminFormat.price(order.totalAmount);
    if (order.paymentStatus == PaymentStatus.confirmed) {
      return order.stockReserved
          ? l10n.adminCancelConfirmedOrderBody(
              order.shortId,
              order.quantity,
              amount,
            )
          : l10n.adminCancelConfirmedOrderBodyNoStock(order.shortId, amount);
    }
    return order.stockReserved
        ? l10n.adminCancelOrderBody(order.shortId, order.quantity)
        : l10n.adminCancelOrderBodyNoStock(order.shortId);
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final actions = ref.read(companyAdminActionsProvider);
    final next = CompanyAdminFormat.nextStatus(order);
    final paymentConfirmed = order.paymentStatus == PaymentStatus.confirmed;
    final awaitingPayment = order.isAwaitingPaymentVerification;

    // Cancelled is final: nothing to confirm or move on, only what happened.
    if (order.isCancelled) {
      return AdminSectionCard(
        title: context.l10n.adminManageOrder,
        children: [OrderCancelledNote(order: order, forCompany: true)],
      );
    }

    final cover = awaitingPayment ? _stockCover(order) : null;
    final cannotCover = cover != null && !cover.covers(order);

    return AdminSectionCard(
      title: context.l10n.adminManageOrder,
      children: [
        if (awaitingPayment) ...[
          Text(
            context.l10n.adminVerifyReceipt,
            style: AppTextStyles.caption
                .copyWith(color: context.colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.s12),
          if (cannotCover) ...[
            AppBanner(
              key: const ValueKey('order-stock-cannot-cover'),
              tone: AppTone.warning,
              message: cover.productGone
                  ? context.l10n.adminProductGoneCannotConfirm
                  : context.l10n
                      .adminStockCannotCover(cover.available, order.quantity),
            ),
            const SizedBox(height: AppSpacing.s12),
          ],
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
                        l10n.adminConfirmPaymentBody(
                          order.shortId,
                          order.quantity,
                        ),
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
              Icon(Icons.check_circle_rounded, color: context.colors.success),
              const SizedBox(width: AppSpacing.s8),
              Expanded(
                child: Text(
                  context.l10n.adminOrderCompleted,
                  style: AppTextStyles.bodyStrong,
                ),
              ),
            ],
          )
        // Nothing moves on before the payment is confirmed (the rules refuse
        // it): no Out for Delivery, no Completed, only why.
        else if (!paymentConfirmed)
          Row(
            key: const ValueKey('order-ship-after-payment'),
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.lock_clock_outlined,
                size: AppSize.iconMd,
                color: context.colors.textSecondary,
              ),
              const SizedBox(width: AppSpacing.s8),
              Expanded(
                child: Text(
                  context.l10n.adminShipAfterPayment,
                  style: AppTextStyles.caption
                      .copyWith(color: context.colors.textSecondary),
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
                    .copyWith(color: context.colors.textSecondary),
              ),
            ),
          AppButton.primary(
              expand: true,
              icon: Icons.arrow_forward_rounded,
              loading: _isBusy,
              label: _nextLabel(next),
              onPressed: () async {
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
        // The product can no longer cover an order still waiting for its
        // payment: it can be cancelled as out of stock (refund outside).
        if (cannotCover) ...[
          const SizedBox(height: AppSpacing.s12),
          AppButton.destructiveOutlined(
            expand: true,
            icon: Icons.remove_shopping_cart_outlined,
            label: context.l10n.adminCancelOutOfStockButton,
            onPressed: _isBusy
                ? null
                : () async {
                    final l10n = context.l10n;
                    final ok = await showConfirmationDialog(
                      context,
                      title: l10n.adminCancelOutOfStockTitle,
                      body: l10n.adminCancelOutOfStockBody(
                        order.shortId,
                        CompanyAdminFormat.price(order.totalAmount),
                      ),
                      confirmLabel: l10n.adminCancelOrderConfirm,
                      cancelLabel: l10n.adminCancelOrderKeep,
                      destructive: true,
                    );
                    if (ok) {
                      await _run(
                        () => actions.cancelOrder(
                          order,
                          reason: OrderCancelReason.outOfStock,
                        ),
                        l10n.adminOrderCancelledOutOfStock,
                      );
                    }
                  },
          ),
        ],
        // While it is Processing: before or after the payment is confirmed.
        if (order.companyMayCancel) ...[
          const SizedBox(height: AppSpacing.s12),
          AppButton.destructiveOutlined(
            expand: true,
            icon: Icons.cancel_outlined,
            label: context.l10n.adminCancelOrderButton,
            onPressed: _isBusy
                ? null
                : () async {
                    final l10n = context.l10n;
                    final ok = await showConfirmationDialog(
                      context,
                      title: l10n.adminCancelOrderTitle,
                      body: _cancelBody(l10n, order),
                      confirmLabel: l10n.adminCancelOrderConfirm,
                      cancelLabel: l10n.adminCancelOrderKeep,
                      destructive: true,
                    );
                    if (ok) {
                      await _run(
                        () => actions.cancelOrder(order),
                        l10n.adminOrderCancelled,
                      );
                    }
                  },
          ),
        ],
      ],
    );
  }
}
