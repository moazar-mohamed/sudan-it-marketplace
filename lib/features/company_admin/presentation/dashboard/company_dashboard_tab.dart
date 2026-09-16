import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../companies/presentation/companies_providers.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../products/presentation/products_providers.dart';
import '../orders/company_order_details_screen.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/company_order_tile.dart';

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
    final company = ref.watch(companyStreamProvider(companyId)).asData?.value;
    final productsAsync = ref.watch(companyProductsStreamProvider(companyId));
    final ordersAsync = ref.watch(companyOrdersStreamProvider(companyId));

    final orders = ordersAsync.asData?.value ?? const <OrderEntity>[];
    final pendingOrders = orders
        .where((order) => order.orderStatus != OrderStatus.completed)
        .length;
    final recentOrders = orders.take(5).toList();

    String count<T>(AsyncValue<List<T>> value) {
      if (value.hasError && !value.hasValue) {
        return '–';
      }
      final items = value.asData?.value;
      return items == null ? '…' : '${items.length}';
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(companyProductsStreamProvider(companyId));
        ref.invalidate(companyOrdersStreamProvider(companyId));
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Text(
            company?.name.isNotEmpty == true ? company!.name : 'Welcome',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Overview of your products and orders',
            style: textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.65),
            ),
          ),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              final tileWidth = (constraints.maxWidth - 12) / 2;
              final tiles = [
                _StatTile(
                  label: 'Total Products',
                  value: count(productsAsync),
                  icon: Icons.inventory_2_outlined,
                  onTap: () => onSelectTab?.call(1),
                ),
                _StatTile(
                  label: 'Total Orders',
                  value: count(ordersAsync),
                  icon: Icons.receipt_long_outlined,
                  onTap: () => onSelectTab?.call(2),
                ),
                _StatTile(
                  label: 'Pending Orders',
                  value: ordersAsync.hasValue ? '$pendingOrders' : '…',
                  icon: Icons.pending_actions_outlined,
                  onTap: () => onSelectTab?.call(2),
                ),
                _StatTile(
                  label: 'Installation Jobs',
                  value: ordersAsync.hasValue
                      ? '${orders.where((o) => o.installationSelected).length}'
                      : '…',
                  icon: Icons.handyman_outlined,
                  onTap: () => onSelectTab?.call(3),
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
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Recent Orders',
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => onSelectTab?.call(2),
                child: const Text('View all'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ordersAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => AdminErrorState(
              message: 'Could not load orders.',
              onRetry: () =>
                  ref.invalidate(companyOrdersStreamProvider(companyId)),
            ),
            data: (_) => recentOrders.isEmpty
                ? const AdminEmptyState(
                    icon: Icons.receipt_long_outlined,
                    message: 'No orders yet.',
                  )
                : Column(
                    children: [
                      for (final order in recentOrders) ...[
                        CompanyOrderTile(
                          order: order,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => CompanyOrderDetailsScreen(
                                companyId: companyId,
                                orderId: order.id,
                              ),
                            ),
                          ),
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
              Icon(icon, color: colorScheme.primary),
              const SizedBox(height: 10),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
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
