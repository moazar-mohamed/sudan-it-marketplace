import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../company_admin_format.dart';
import '../orders/company_order_details_screen.dart';
import '../widgets/admin_section_card.dart';

/// The app has no notification backend yet, so this screen lists order
/// activity that needs the company's attention, derived from its orders.
class CompanyNotificationsScreen extends ConsumerWidget {
  const CompanyNotificationsScreen({super.key, required this.companyId});

  final String companyId;

  ({IconData icon, Color color, String title, String body}) _describe(
    OrderEntity order,
    ColorScheme colorScheme,
  ) {
    if (order.paymentStatus == PaymentStatus.pendingVerification) {
      return (
        icon: Icons.receipt_long_outlined,
        color: Colors.amber.shade800,
        title: 'New order — receipt awaiting verification',
        body:
            '${order.productName} × ${order.quantity} from ${CompanyAdminFormat.customer(order)}',
      );
    }
    return switch (order.orderStatus) {
      OrderStatus.processing => (
          icon: Icons.inventory_outlined,
          color: colorScheme.primary,
          title: order.installationSelected
              ? 'Paid order with installation to prepare'
              : 'Paid order ready to prepare',
          body: order.productName,
        ),
      OrderStatus.outForDelivery => (
          icon: Icons.local_shipping_outlined,
          color: Colors.deepOrange,
          title: order.installationSelected
              ? 'Out for delivery — installation pending'
              : 'Order out for delivery',
          body: order.productName,
        ),
      OrderStatus.completed => (
          icon: Icons.check_circle_outline,
          color: Colors.green,
          title: 'Order completed',
          body: order.productName,
        ),
    };
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(companyOrdersStreamProvider(companyId));
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ordersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => AdminErrorState(
          message: 'Could not load notifications.',
          onRetry: () =>
              ref.invalidate(companyOrdersStreamProvider(companyId)),
        ),
        data: (orders) {
          final items = [...orders]..sort((a, b) =>
              (b.updatedAt ?? b.createdAt).compareTo(a.updatedAt ?? a.createdAt));
          if (items.isEmpty) {
            return ListView(
              children: const [
                AdminEmptyState(
                  icon: Icons.notifications_none_outlined,
                  message: 'No notifications yet.',
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final order = items[index];
              final info = _describe(order, colorScheme);
              return ListTile(
                leading: CircleAvatar(
                  backgroundColor: info.color.withValues(alpha: 0.12),
                  foregroundColor: info.color,
                  child: Icon(info.icon),
                ),
                title: Text(
                  info.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: Text(
                  '${info.body}\nOrder #${order.shortId} • '
                  '${CompanyAdminFormat.date(order.updatedAt ?? order.createdAt)}',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                isThreeLine: true,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => CompanyOrderDetailsScreen(
                      companyId: companyId,
                      orderId: order.id,
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
