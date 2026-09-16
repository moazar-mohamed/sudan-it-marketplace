import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../orders/domain/entities/order_entity.dart';

/// Small presentation helpers used across the Technician screens.
class TechnicianFormat {
  TechnicianFormat._();

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

  static String customer(OrderEntity order) {
    if (order.customerName.trim().isNotEmpty) {
      return order.customerName.trim();
    }
    final id = order.customerId;
    return 'Customer ${id.length > 6 ? id.substring(0, 6) : id}';
  }

  static Color jobStatusColor(OrderStatus status) {
    return switch (status) {
      OrderStatus.processing => AppColors.primary,
      OrderStatus.outForDelivery => Colors.deepOrange,
      OrderStatus.completed => AppColors.success,
    };
  }

  /// Installation jobs follow their product order's lifecycle.
  static String jobStatusLabel(OrderEntity order) {
    return switch (order.orderStatus) {
      OrderStatus.processing => 'Pending',
      OrderStatus.outForDelivery => 'In Progress',
      OrderStatus.completed => 'Completed',
    };
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
