import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/search_ranking.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/widgets/app_widgets.dart';
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
      loading: () => ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: const [AppSkeletonList()],
      ),
      error: (_, _) => AppErrorState(
        message: context.l10n.adminOrdersLoadFailed,
        onRetry: () =>
            ref.invalidate(companyOrdersStreamProvider(widget.companyId)),
      ),
      data: (orders) {
        final visible = searchRanked(
          orders.where(
            (o) => _statusFilter == null || o.orderStatus == _statusFilter,
          ),
          _query,
          (o) => [
            SearchField(o.productName, weight: 3),
            SearchField(o.customerName, weight: 3),
            // The full id, so both the short number people read out and the whole
            // reference match (the short number is its prefix).
            SearchField(o.id, weight: 2),
            SearchField(o.contactPhone),
          ],
        );
        return ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.s16,
            AppSpacing.s12,
            AppSpacing.s16,
            AppSpacing.s24,
          ),
          children: [
            AppSearchField(
              hint: context.l10n.adminSearchOrders,
              onChanged: (value) => setState(() => _query = value),
            ),
            const SizedBox(height: AppSpacing.s8),
            AppFilterChips(
              labels: [
                context.l10n.adminFilterAll(orders.length),
                for (final status in OrderStatus.values)
                  context.l10n.adminFilterStatus(
                    status.label(context.l10n),
                    orders.where((o) => o.orderStatus == status).length,
                  ),
              ],
              selectedIndex: _statusFilter == null
                  ? 0
                  : OrderStatus.values.indexOf(_statusFilter!) + 1,
              onChanged: (index) => setState(
                () => _statusFilter =
                    index == 0 ? null : OrderStatus.values[index - 1],
              ),
            ),
            const SizedBox(height: 12),
            if (visible.isEmpty)
              AppEmptyState(
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
                const SizedBox(height: AppSpacing.s12),
              ],
          ],
        );
      },
    );
  }
}
