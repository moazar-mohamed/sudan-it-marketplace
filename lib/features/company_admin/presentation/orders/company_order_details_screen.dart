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
import '../widgets/technician_assignment_card.dart';
import '../../../../core/localization/l10n_extension.dart';
import '../../../orders/presentation/order_labels.dart';

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
        title: Text(order == null ? context.l10n.orderDetailsTitle : context.l10n.orderTitleNumber(order.shortId)),
      ),
      body: order == null
          ? (ordersAsync.isLoading
              ? const Center(child: CircularProgressIndicator())
              : AdminErrorState(message: context.l10n.adminOrderNotFound))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                _OrderSummaryCard(order: order),
                const SizedBox(height: 12),
                OrderStatusActions(order: order),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: context.l10n.adminCustomer,
                  children: [
                    AdminInfoRow(
                      label: context.l10n.adminName,
                      value: CompanyAdminFormat.customer(order, context.l10n),
                    ),
                    AdminInfoRow(
                      label: context.l10n.orderContactPhone,
                      value: order.contactPhone,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: context.l10n.adminProduct,
                  children: [
                    AdminInfoRow(label: context.l10n.adminProduct, value: order.productName),
                    AdminInfoRow(label: context.l10n.adminQuantity, value: '${order.quantity}'),
                    AdminInfoRow(
                      label: context.l10n.adminUnitPrice,
                      value: CompanyAdminFormat.price(order.unitPrice),
                    ),
                    AdminInfoRow(
                      label: context.l10n.orderProductSubtotal,
                      value: CompanyAdminFormat.price(order.productSubtotal),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: order.deliveryMethod == DeliveryMethod.pickup
                      ? context.l10n.checkoutPickup
                      : context.l10n.checkoutDelivery,
                  children: [
                    AdminInfoRow(
                      label: context.l10n.adminMethod,
                      value: order.deliveryMethod.label(context.l10n),
                    ),
                    AdminInfoRow(
                      label: order.deliveryMethod == DeliveryMethod.pickup
                          ? context.l10n.checkoutPickupLocation
                          : context.l10n.pendingDeliveryAddress,
                      value: orderDeliveryLabel(context, order),
                    ),
                    if (order.deliveryMethod == DeliveryMethod.delivery)
                      AdminInfoRow(
                        label: context.l10n.orderDeliveryFee,
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
                  title: context.l10n.pendingInstallation,
                  children: [
                    AdminInfoRow(
                      label: context.l10n.adminSelection,
                      value: order.installationSelected
                          ? context.l10n.checkoutProductInstallation
                          : context.l10n.checkoutProductOnly,
                    ),
                    if (order.installationSelected) ...[
                      AdminInfoRow(
                        label: context.l10n.orderInstallationFee,
                        value: CompanyAdminFormat.price(order.installationFee),
                      ),
                      AdminInfoRow(
                        label: context.l10n.adminJobStatus,
                        value: CompanyAdminFormat.installationJobStatus(order, context.l10n),
                      ),
                    ],
                  ],
                ),
                // Whoever installs the product is chosen right here, from the
                // company's own technicians.
                if (order.installationSelected) ...[
                  const SizedBox(height: 12),
                  TechnicianAssignmentCard(companyId: companyId, order: order),
                ],
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: context.l10n.adminPayment,
                  children: [
                    AdminInfoRow(
                      label: context.l10n.orderTotalAmount,
                      value: CompanyAdminFormat.price(order.totalAmount),
                      valueColor: AppColors.primary,
                      emphasize: true,
                    ),
                    AdminInfoRow(
                      label: context.l10n.orderPaymentStatus,
                      value: order.paymentStatus.label(context.l10n),
                      valueColor: CompanyAdminFormat.paymentStatusColor(
                        order.paymentStatus,
                      ),
                    ),
                    AdminInfoRow(
                      label: context.l10n.adminReceiptReference,
                      value: (order.receiptFileName ?? '').trim().isEmpty
                          ? context.l10n.adminNotProvided
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
      title: context.l10n.adminOrderInformation,
      trailing: StatusBadge(
        label: order.orderStatus.label(context.l10n),
        color: CompanyAdminFormat.orderStatusColor(order.orderStatus),
      ),
      children: [
        AdminInfoRow(label: context.l10n.adminOrderNumber, value: order.id),
        AdminInfoRow(
          label: context.l10n.adminCreated,
          value: CompanyAdminFormat.date(order.createdAt),
        ),
        if (order.updatedAt != null)
          AdminInfoRow(
            label: context.l10n.adminLastUpdated,
            value: CompanyAdminFormat.date(order.updatedAt!),
          ),
        AdminInfoRow(
          label: context.l10n.orderOrderStatus,
          value: order.orderStatus.label(context.l10n),
          valueColor: CompanyAdminFormat.orderStatusColor(order.orderStatus),
        ),
      ],
    );
  }
}
