import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/arabic_text.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/company_order_tile.dart';
import 'company_order_details_screen.dart';
import '../../../../core/localization/l10n_extension.dart';
import '../../../orders/presentation/order_labels.dart';

class CompanyOrdersTab extends ConsumerStatefulWidget {
  const CompanyOrdersTab({super.key, required this.companyId});

  final String companyId;

  @override
  ConsumerState<CompanyOrdersTab> createState() => _CompanyOrdersTabState();
}

class _CompanyOrdersTabState extends ConsumerState<CompanyOrdersTab> {
  /// null shows all orders; otherwise only orders with this status.
  OrderStatus? _statusFilter;
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final ordersAsync =
        ref.watch(companyOrdersStreamProvider(widget.companyId));

    return ordersAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => AdminErrorState(
        message: context.l10n.adminOrdersLoadFailed,
        onRetry: () =>
            ref.invalidate(companyOrdersStreamProvider(widget.companyId)),
      ),
      data: (orders) {
        final query = normalizeSearchText(_query);
        final visible = orders
            .where((o) => _statusFilter == null || o.orderStatus == _statusFilter)
            .where(
              (o) =>
                  query.isEmpty ||
                  normalizeSearchText(o.productName).contains(query) ||
                  normalizeSearchText(o.customerName).contains(query),
            )
            .toList();
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            TextField(
              onChanged: (value) => setState(() => _query = value),
              decoration: InputDecoration(
                hintText: context.l10n.adminSearchOrders,
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Theme.of(context).colorScheme.surface,
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _chip(context.l10n.adminFilterAll(orders.length), null),
                  for (final status in OrderStatus.values)
                    _chip(
                      context.l10n.adminFilterStatus(
                        status.label(context.l10n),
                        orders.where((o) => o.orderStatus == status).length,
                      ),
                      status,
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (visible.isEmpty)
              AdminEmptyState(
                icon: Icons.receipt_long_outlined,
                message: context.l10n.adminNoOrdersToShow,
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
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: _statusFilter == status,
        onSelected: (_) => setState(() => _statusFilter = status),
      ),
    );
  }
}
