import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/presentation/products_providers.dart';
import '../company_admin_format.dart';
import '../orders/company_order_details_screen.dart';
import '../products/company_product_details_screen.dart';
import '../products/product_form_screen.dart';
import '../services/my_services_view.dart';
import '../technicians/technician_form_screen.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/company_order_tile.dart';
import '../widgets/status_badge.dart';

/// A product with this many units or fewer counts as low on stock.
const lowStockThreshold = 3;

class CompanyDashboardTab extends ConsumerWidget {
  const CompanyDashboardTab({
    super.key,
    required this.companyId,
    this.onSelectTab,
  });

  final String companyId;
  final ValueChanged<int>? onSelectTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final textTheme = theme.textTheme;
    final productsAsync = ref.watch(companyProductsStreamProvider(companyId));
    final ordersAsync = ref.watch(companyOrdersStreamProvider(companyId));

    final orders = ordersAsync.asData?.value ?? const <OrderEntity>[];
    final products = productsAsync.asData?.value ?? const <Product>[];
    final open = orders
        .where((order) => order.orderStatus != OrderStatus.completed)
        .toList();
    final newOrders =
        orders.where((o) => o.orderStatus == OrderStatus.processing).length;
    final installJobs = open.where((o) => o.installationSelected).length;
    final weekAgo = DateTime.now().subtract(const Duration(days: 7));
    final weekSales = orders
        .where((o) => o.createdAt.isAfter(weekAgo))
        .fold<double>(0, (sum, o) => sum + o.totalAmount);
    final lowStock =
        products.where((p) => p.stockCount <= lowStockThreshold).toList();

    final attention = <Widget>[
      for (final order in open)
        if (order.paymentStatus == PaymentStatus.pendingVerification)
          _AttentionRow(
            icon: Icons.receipt_long_outlined,
            title: '${order.productName} · #${order.shortId}',
            subtitle: CompanyAdminFormat.customer(order, context.l10n),
            label: context.l10n.adminAttentionVerifyPayment,
            color: Colors.orange,
            onTap: () => _openOrder(context, order),
          ),
      for (final order in open)
        if (order.installationSelected && order.technicianId == null)
          _AttentionRow(
            icon: Icons.handyman_outlined,
            title: '${order.productName} · #${order.shortId}',
            subtitle: CompanyAdminFormat.customer(order, context.l10n),
            label: context.l10n.adminAttentionAssignTechnician,
            color: AppColors.primary,
            onTap: () => _openOrder(context, order),
          ),
      for (final product in lowStock)
        _AttentionRow(
          icon: Icons.inventory_2_outlined,
          title: product.name,
          subtitle: context.l10n.adminUnitsLeft(product.stockCount),
          label: context.l10n.adminAttentionRestock,
          color: Colors.orange,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => CompanyProductDetailsScreen(
                companyId: companyId,
                productId: product.id,
              ),
            ),
          ),
        ),
    ];

    final recentOrders = orders.take(3).toList();

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(companyProductsStreamProvider(companyId));
        ref.invalidate(companyOrdersStreamProvider(companyId));
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final tileWidth = (constraints.maxWidth - 12) / 2;
              final tiles = [
                _StatTile(
                  label: context.l10n.adminStatNewOrders,
                  value: ordersAsync.hasValue ? '$newOrders' : '…',
                  icon: Icons.receipt_long_outlined,
                  onTap: () => onSelectTab?.call(2),
                ),
                _StatTile(
                  label: context.l10n.adminInstallationJobs,
                  value: ordersAsync.hasValue ? '$installJobs' : '…',
                  icon: Icons.handyman_outlined,
                  onTap: () => onSelectTab?.call(3),
                ),
                _StatTile(
                  label: context.l10n.adminStatSalesWeek,
                  value: ordersAsync.hasValue
                      ? CompanyAdminFormat.price(weekSales)
                      : '…',
                  icon: Icons.trending_up,
                  onTap: () => onSelectTab?.call(2),
                ),
                _StatTile(
                  label: context.l10n.adminStatLowStock,
                  value: productsAsync.hasValue ? '${lowStock.length}' : '…',
                  icon: Icons.inventory_2_outlined,
                  onTap: () => onSelectTab?.call(1),
                ),
              ];
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (final tile in tiles)
                    SizedBox(width: tileWidth, child: tile),
                ],
              );
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _QuickAction(
                  icon: Icons.add_box_outlined,
                  label: context.l10n.adminQuickProduct,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ProductFormScreen.add(companyId: companyId),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickAction(
                  icon: Icons.design_services_outlined,
                  label: context.l10n.adminQuickService,
                  onTap: () => showCreateOwnService(context, ref, companyId),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickAction(
                  icon: Icons.engineering_outlined,
                  label: context.l10n.adminQuickTechnician,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          TechnicianFormScreen.add(companyId: companyId),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            context.l10n.adminNeedsAttention,
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          if (attention.isEmpty)
            AdminEmptyState(
              icon: Icons.check_circle_outline,
              message: context.l10n.adminNothingToDo,
            )
          else
            Container(
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.08),
                ),
              ),
              child: Column(
                children: [
                  for (var i = 0; i < attention.length && i < 5; i++) ...[
                    if (i > 0)
                      Divider(
                        height: 1,
                        color:
                            theme.colorScheme.onSurface.withValues(alpha: 0.08),
                      ),
                    attention[i],
                  ],
                ],
              ),
            ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: Text(
                  context.l10n.adminRecentOrders,
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => onSelectTab?.call(2),
                child: Text(context.l10n.adminViewAll),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ordersAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, _) => AdminErrorState(
              message: context.l10n.adminOrdersLoadFailedShort,
              onRetry: () =>
                  ref.invalidate(companyOrdersStreamProvider(companyId)),
            ),
            data: (_) => recentOrders.isEmpty
                ? AdminEmptyState(
                    icon: Icons.receipt_long_outlined,
                    message: context.l10n.adminNoOrdersYet,
                  )
                : Column(
                    children: [
                      for (final order in recentOrders) ...[
                        CompanyOrderTile(
                          order: order,
                          onTap: () => _openOrder(context, order),
                        ),
                        const SizedBox(height: 10),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  void _openOrder(BuildContext context, OrderEntity order) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CompanyOrderDetailsScreen(
          companyId: companyId,
          orderId: order.id,
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Material(
      color: colorScheme.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: colorScheme.onSurface.withValues(alpha: 0.08),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: colorScheme.primary, size: 22),
              const SizedBox(height: 8),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: AlignmentDirectional.centerStart,
                child: Text(
                  value,
                  maxLines: 1,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurface.withValues(alpha: 0.65),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Material(
      color: colorScheme.primary.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          child: Column(
            children: [
              Icon(icon, color: colorScheme.primary),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AttentionRow extends StatelessWidget {
  const _AttentionRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Icon(icon, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.65),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Flexible(child: StatusBadge(label: label, color: color)),
          ],
        ),
      ),
    );
  }
}
