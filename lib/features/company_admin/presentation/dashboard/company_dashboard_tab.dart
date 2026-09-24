import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
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
import '../widgets/company_order_tile.dart';

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
            tone: AppTone.warning,
            onTap: () => _openOrder(context, order),
          ),
      for (final order in open)
        if (order.installationSelected && order.technicianId == null)
          _AttentionRow(
            icon: Icons.handyman_outlined,
            title: '${order.productName} · #${order.shortId}',
            subtitle: CompanyAdminFormat.customer(order, context.l10n),
            label: context.l10n.adminAttentionAssignTechnician,
            tone: AppTone.brand,
            onTap: () => _openOrder(context, order),
          ),
      for (final product in lowStock)
        _AttentionRow(
          icon: Icons.inventory_2_outlined,
          title: product.name,
          subtitle: context.l10n.adminUnitsLeft(product.stockCount),
          label: context.l10n.adminAttentionRestock,
          tone: AppTone.warning,
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

    final margin = AppSpacing.screenMargin(MediaQuery.sizeOf(context).width);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(companyProductsStreamProvider(companyId));
        ref.invalidate(companyOrdersStreamProvider(companyId));
      },
      child: ListView(
        padding: EdgeInsets.fromLTRB(margin, AppSpacing.s16, margin, AppSpacing.s24),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: AppSize.contentMax),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LayoutBuilder(
                    builder: (context, constraints) {
                      // Two columns on a phone, four when there is room.
                      final columns = constraints.maxWidth >= 720 ? 4 : 2;
                      final tileWidth = (constraints.maxWidth -
                              AppSpacing.s12 * (columns - 1)) /
                          columns;
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
                          value: productsAsync.hasValue
                              ? '${lowStock.length}'
                              : '…',
                          icon: Icons.inventory_2_outlined,
                          tone: lowStock.isEmpty
                              ? AppTone.brand
                              : AppTone.warning,
                          onTap: () => onSelectTab?.call(1),
                        ),
                      ];
                      return Wrap(
                        spacing: AppSpacing.s12,
                        runSpacing: AppSpacing.s12,
                        children: [
                          for (final tile in tiles)
                            SizedBox(width: tileWidth, child: tile),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: AppSpacing.s16),
                  Row(
                    children: [
                      Expanded(
                        child: _QuickAction(
                          icon: Icons.add_box_outlined,
                          label: context.l10n.adminQuickProduct,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) =>
                                  ProductFormScreen.add(companyId: companyId),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.s8),
                      Expanded(
                        child: _QuickAction(
                          icon: Icons.design_services_outlined,
                          label: context.l10n.adminQuickService,
                          onTap: () =>
                              showCreateOwnService(context, ref, companyId),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.s8),
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
                  const SizedBox(height: AppSpacing.s24),
                  Text(context.l10n.adminNeedsAttention, style: AppTextStyles.h3),
                  const SizedBox(height: AppSpacing.s8),
                  if (attention.isEmpty)
                    AppEmptyState(
                      icon: Icons.check_circle_outline,
                      tone: AppTone.success,
                      message: context.l10n.adminNothingToDo,
                    )
                  else
                    AppCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          for (var i = 0; i < attention.length && i < 5; i++) ...[
                            if (i > 0) const Divider(height: 1),
                            attention[i],
                          ],
                        ],
                      ),
                    ),
                  const SizedBox(height: AppSpacing.s24),
                  SectionHeader(
                    title: context.l10n.adminRecentOrders,
                    actionLabel: context.l10n.adminViewAll,
                    onAction: () => onSelectTab?.call(2),
                  ),
                  const SizedBox(height: AppSpacing.s8),
                  ordersAsync.when(
                    loading: () => const AppSkeletonList(count: 2),
                    error: (_, _) => AppErrorState(
                      message: context.l10n.adminOrdersLoadFailedShort,
                      onRetry: () =>
                          ref.invalidate(companyOrdersStreamProvider(companyId)),
                    ),
                    data: (_) => recentOrders.isEmpty
                        ? AppEmptyState(
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
                                const SizedBox(height: AppSpacing.s12),
                              ],
                            ],
                          ),
                  ),
                ],
              ),
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
    this.tone = AppTone.brand,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final AppTone tone;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppIconTile(icon: icon, tone: tone, size: 36),
          const SizedBox(height: AppSpacing.s8),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(value, maxLines: 1, style: AppTextStyles.stat),
          ),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.caption
                .copyWith(color: AppColors.textSecondary),
          ),
        ],
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
    return AppCard(
      onTap: onTap,
      color: AppColors.brandPrimarySubtle,
      borderColor: AppColors.brandPrimarySubtle,
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.s12,
        horizontal: AppSpacing.s4,
      ),
      child: Column(
        children: [
          Icon(icon, color: AppColors.primary),
          const SizedBox(height: AppSpacing.s4),
          Text(
            label,
            maxLines: 2,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.labelMedium
                .copyWith(color: AppColors.textBrand),
          ),
        ],
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
    required this.tone,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String label;
  final AppTone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.mdAll,
      child: Container(
        constraints: const BoxConstraints(minHeight: AppSize.touchMin),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s16,
          vertical: AppSpacing.s12,
        ),
        child: Row(
          children: [
            Icon(icon, color: AppColors.iconDefault),
            const SizedBox(width: AppSpacing.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodyStrong,
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.s8),
            Flexible(child: StatusChip(label: label, tone: tone)),
          ],
        ),
      ),
    );
  }
}
