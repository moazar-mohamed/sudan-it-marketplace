import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../../orders/domain/entities/order_entity.dart';
import '../../orders/presentation/order_labels.dart';

/// Small presentation helpers shared by the Company Admin screens.
class CompanyAdminFormat {
  CompanyAdminFormat._();

  static String price(double value, [String currency = 'SDG']) {
    final whole = value.toStringAsFixed(0);
    final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return '${whole.replaceAllMapped(regExp, (m) => '${m[1]},')} $currency';
  }

  static String date(DateTime value) {
    final local = value.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${local.year}-${two(local.month)}-${two(local.day)} '
        '${two(local.hour)}:${two(local.minute)}';
  }

  static String customer(OrderEntity order, AppLocalizations l10n) {
    if (order.customerName.trim().isNotEmpty) {
      return order.customerName.trim();
    }
    final id = order.customerId;
    return l10n.customerFallback(id.length > 6 ? id.substring(0, 6) : id);
  }

  /// Text colour for a status shown as plain text (not as a chip).
  static Color orderStatusColor(OrderStatus status) => status.tone.foreground;

  static Color paymentStatusColor(PaymentStatus status) =>
      status.tone.foreground;

  /// Installation jobs follow their product order's lifecycle.
  static String installationJobStatus(
    OrderEntity order,
    AppLocalizations l10n,
  ) {
    return order.orderStatus.jobLabel(l10n);
  }

  /// The next allowed status in Processing -> Out for Delivery -> Completed.
  /// Pickup orders are never out for delivery, so they complete directly.
  static OrderStatus? nextStatus(OrderEntity order) {
    return switch (order.orderStatus) {
      OrderStatus.processing => order.deliveryMethod == DeliveryMethod.pickup
          ? OrderStatus.completed
          : OrderStatus.outForDelivery,
      OrderStatus.outForDelivery => OrderStatus.completed,
      OrderStatus.completed => null,
    };
  }
}
