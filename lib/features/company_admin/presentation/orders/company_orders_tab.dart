import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/company_order_tile.dart';
import 'company_order_details_screen.dart';

class CompanyOrdersTab extends ConsumerStatefulWidget {
  const CompanyOrdersTab({super.key, required this.companyId});

  final String companyId;

  @override
  ConsumerState<CompanyOrdersTab> createState() => _CompanyOrdersTabState();
}

class _CompanyOrdersTabState extends ConsumerState<CompanyOrdersTab> {
  /// null shows all orders; otherwise only orders with this status.
  OrderStatus? _statusFilter;

  @override
  Widget build(BuildContext context) {
    final ordersAsync =
        ref.watch(companyOrdersStreamProvider(widget.companyId));

    return ordersAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => AdminErrorState(
        message: 'Could not load your orders.',
        onRetry: () =>
            ref.invalidate(companyOrdersStreamProvider(widget.companyId)),
      ),
      data: (orders) {
        final visible = _statusFilter == null
            ? orders
            : orders.where((o) => o.orderStatus == _statusFilter).toList();
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _chip('All (${orders.length})', null),
                for (final status in OrderStatus.values)
                  _chip(
                    '${status.displayName} '
                    '(${orders.where((o) => o.orderStatus == status).length})',
                    status,
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (visible.isEmpty)
              const AdminEmptyState(
                icon: Icons.receipt_long_outlined,
                message: 'No orders to show.',
              )
            else
              for (final order in visible) ...[
                CompanyOrderTile(
                  order: order,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => CompanyOrderDetailsScreen(
                        companyId: widget.companyId,
                        orderId: order.id,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
          ],
        );
      },
    );
  }

  Widget _chip(String label, OrderStatus? status) {
    return ChoiceChip(
      label: Text(label),
      selected: _statusFilter == status,
      onSelected: (_) => setState(() => _statusFilter = status),
    );
  }
}
