import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../location/presentation/location_strings.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../company_admin_format.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/order_status_actions.dart';
import '../widgets/status_badge.dart';

/// Looks up a company order from the live company orders stream so status
/// changes are reflected immediately.
OrderEntity? findCompanyOrder(List<OrderEntity>? orders, String orderId) {
  for (final order in orders ?? const <OrderEntity>[]) {
    if (order.id == orderId) {
      return order;
    }
  }
  return null;
}

class CompanyOrderDetailsScreen extends ConsumerWidget {
  const CompanyOrderDetailsScreen({
    super.key,
    required this.companyId,
    required this.orderId,
  });

  final String companyId;
  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(companyOrdersStreamProvider(companyId));
    final order = findCompanyOrder(ordersAsync.asData?.value, orderId);

    return Scaffold(
      appBar: AppBar(
        title: Text(order == null ? 'Order Details' : 'Order #${order.shortId}'),
      ),
      body: order == null
          ? (ordersAsync.isLoading
              ? const Center(child: CircularProgressIndicator())
              : const AdminErrorState(message: 'This order was not found.'))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                _OrderSummaryCard(order: order),
                const SizedBox(height: 12),
                OrderStatusActions(order: order),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: 'Customer',
                  children: [
                    AdminInfoRow(
                      label: 'Name',
                      value: CompanyAdminFormat.customer(order),
                    ),
                    AdminInfoRow(
                      label: 'Contact Phone',
                      value: order.contactPhone,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: 'Product',
                  children: [
                    AdminInfoRow(label: 'Product', value: order.productName),
                    AdminInfoRow(label: 'Quantity', value: '${order.quantity}'),
                    AdminInfoRow(
                      label: 'Unit Price',
                      value: CompanyAdminFormat.price(order.unitPrice),
                    ),
                    AdminInfoRow(
                      label: 'Product Subtotal',
                      value: CompanyAdminFormat.price(order.productSubtotal),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: order.deliveryMethod == DeliveryMethod.pickup
                      ? 'Pickup'
                      : 'Delivery',
                  children: [
                    AdminInfoRow(
                      label: 'Method',
                      value: order.deliveryMethod.displayName,
                    ),
                    AdminInfoRow(
                      label: order.deliveryMethod == DeliveryMethod.pickup
                          ? 'Pickup Location'
                          : 'Delivery Address',
                      value: orderDeliveryLabel(context, order),
                    ),
                    if (order.deliveryMethod == DeliveryMethod.delivery)
                      AdminInfoRow(
                        label: 'Delivery Fee',
                        value: CompanyAdminFormat.price(order.deliveryFee),
                      ),
                    // Read-only: the customer's saved delivery point, or the
                    // company's own location for a pickup order.
                    const SizedBox(height: 8),
                    OrderLocationButton(
                      order: order,
                      label: LocationStrings.of(context).openDeliveryLocation,
                    ),
                    PickupCompanyLocationButton(order: order),
                  ],
                ),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: 'Installation',
                  children: [
                    AdminInfoRow(
                      label: 'Selection',
                      value: order.installationSelected
                          ? 'Product + Installation'
                          : 'Product Only',
                    ),
                    if (order.installationSelected) ...[
                      AdminInfoRow(
                        label: 'Installation Fee',
                        value: CompanyAdminFormat.price(order.installationFee),
                      ),
                      AdminInfoRow(
                        label: 'Job Status',
                        value: CompanyAdminFormat.installationJobStatus(order),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: 'Payment',
                  children: [
                    AdminInfoRow(
                      label: 'Total Amount',
                      value: CompanyAdminFormat.price(order.totalAmount),
                      valueColor: AppColors.primary,
                      emphasize: true,
                    ),
                    AdminInfoRow(
                      label: 'Payment Status',
                      value: order.paymentStatus.displayName,
                      valueColor: CompanyAdminFormat.paymentStatusColor(
                        order.paymentStatus,
                      ),
                    ),
                    AdminInfoRow(
                      label: 'Receipt Reference',
                      value: (order.receiptFileName ?? '').trim().isEmpty
                          ? 'Not provided'
                          : order.receiptFileName!,
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}

class _OrderSummaryCard extends StatelessWidget {
  const _OrderSummaryCard({required this.order});

  final OrderEntity order;

  @override
  Widget build(BuildContext context) {
    return AdminSectionCard(
      title: 'Order Information',
      trailing: StatusBadge(
        label: order.orderStatus.displayName,
        color: CompanyAdminFormat.orderStatusColor(order.orderStatus),
      ),
      children: [
        AdminInfoRow(label: 'Order Number', value: order.id),
        AdminInfoRow(
          label: 'Created',
          value: CompanyAdminFormat.date(order.createdAt),
        ),
        if (order.updatedAt != null)
          AdminInfoRow(
            label: 'Last Updated',
            value: CompanyAdminFormat.date(order.updatedAt!),
          ),
        AdminInfoRow(
          label: 'Order Status',
          value: order.orderStatus.displayName,
          valueColor: CompanyAdminFormat.orderStatusColor(order.orderStatus),
        ),
      ],
    );
  }
}
