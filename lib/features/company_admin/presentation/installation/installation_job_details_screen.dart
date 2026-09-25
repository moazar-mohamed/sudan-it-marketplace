import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../location/presentation/location_strings.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../orders/presentation/widgets/order_location_widgets.dart';
import '../company_admin_format.dart';
import '../orders/company_order_details_screen.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/order_status_actions.dart';
import '../widgets/status_badge.dart';
import '../widgets/technician_assignment_card.dart';
import '../../../../core/localization/l10n_extension.dart';
import '../../../orders/presentation/order_labels.dart';

class InstallationJobDetailsScreen extends ConsumerWidget {
  const InstallationJobDetailsScreen({
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
        title: Text(order == null ? context.l10n.adminInstallationJob : context.l10n.adminJobTitleNumber(order.shortId)),
      ),
      body: order == null
          ? (ordersAsync.isLoading
              ? const AppLoadingState()
              : AdminErrorState(message: context.l10n.adminJobNotFound))
          : AppCenteredList(
              children: [
                AdminSectionCard(
                  title: context.l10n.adminInstallationJob,
                  trailing: StatusBadge(
                    label: CompanyAdminFormat.installationJobStatus(order, context.l10n),
                    tone: order.orderStatus.tone,
                  ),
                  children: [
                    AdminInfoRow(label: context.l10n.adminJobOrderNumber, value: '#${order.shortId}', valueTextDirection: TextDirection.ltr),
                    AdminInfoRow(label: context.l10n.adminProduct, value: order.productName),
                    AdminInfoRow(label: context.l10n.adminQuantity, value: '${order.quantity}'),
                    AdminInfoRow(
                      label: context.l10n.orderInstallationFee,
                      value: CompanyAdminFormat.price(order.installationFee),
                    ),
                    AdminInfoRow(
                      label: context.l10n.orderOrderStatus,
                      value: order.orderStatus.label(context.l10n),
                    ),
                    AdminInfoRow(
                      label: context.l10n.adminCreated,
                      value: CompanyAdminFormat.date(order.createdAt),
                      valueTextDirection: TextDirection.ltr,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AdminSectionCard(
                  title: context.l10n.adminCustomerLocation,
                  children: [
                    AdminInfoRow(
                      label: context.l10n.adminCustomer,
                      value: CompanyAdminFormat.customer(order, context.l10n),
                    ),
                    AdminInfoRow(
                      label: context.l10n.orderContactPhone,
                      value: order.contactPhone,
                      valueTextDirection: TextDirection.ltr,
                    ),
                    AdminInfoRow(
                      label: order.deliveryMethod == DeliveryMethod.delivery
                          ? context.l10n.adminInstallationAddress
                          : context.l10n.adminLocation,
                      value: order.deliveryMethod == DeliveryMethod.delivery
                          ? orderDeliveryLabel(context, order)
                          : context.l10n.adminCustomerPickupConfirm,
                    ),
                    const SizedBox(height: 8),
                    OrderLocationButton(
                      order: order,
                      label: LocationStrings.of(context).openDeliveryLocation,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TechnicianAssignmentCard(companyId: companyId, order: order),
                const SizedBox(height: 12),
                OrderStatusActions(order: order),
                const SizedBox(height: 12),
                AppButton.outlined(
                  expand: true,
                  icon: Icons.receipt_long_outlined,
                  label: context.l10n.adminViewFullOrder,
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => CompanyOrderDetailsScreen(
                        companyId: companyId,
                        orderId: order.id,
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
