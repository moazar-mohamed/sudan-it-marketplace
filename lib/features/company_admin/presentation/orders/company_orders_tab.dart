import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/utils/search_ranking.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../service_requests/domain/entities/service_request.dart';
import '../../../service_requests/presentation/service_request_providers.dart';
import '../../../service_requests/presentation/widgets/service_request_tile.dart';
import '../installation/installation_job_details_screen.dart';
import '../widgets/company_order_tile.dart';
import 'company_order_details_screen.dart';

/// The sections of the company's Orders page. Every product order sits in
/// exactly one, by the most it asks of the company: installation, else
/// delivery, else pickup. Service requests are their own section.
enum CompanyOrdersSection { all, pickup, delivery, installation, services }

CompanyOrdersSection sectionOfOrder(OrderEntity order) {
  if (order.installationSelected) return CompanyOrdersSection.installation;
  return order.deliveryMethod == DeliveryMethod.pickup
      ? CompanyOrdersSection.pickup
      : CompanyOrdersSection.delivery;
}

/// Product orders and service requests in one page, split into sections.
/// The shell owns the selected [section] so the dashboard can open a section.
class CompanyOrdersTab extends ConsumerStatefulWidget {
  const CompanyOrdersTab({
    super.key,
    required this.companyId,
    required this.section,
    required this.onSectionChanged,
  });

  final String companyId;
  final CompanyOrdersSection section;
  final ValueChanged<CompanyOrdersSection> onSectionChanged;

  @override
  ConsumerState<CompanyOrdersTab> createState() => _CompanyOrdersTabState();
}

/// One row of the list: a product order or a service request.
sealed class _Entry {
  DateTime get createdAt;
}

class _OrderEntry extends _Entry {
  _OrderEntry(this.order);
  final OrderEntity order;
  @override
  DateTime get createdAt => order.createdAt;
}

class _RequestEntry extends _Entry {
  _RequestEntry(this.request);
  final ServiceRequest request;
  @override
  DateTime get createdAt => request.createdAt;
}

class _CompanyOrdersTabState extends ConsumerState<CompanyOrdersTab> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final companyId = widget.companyId;
    final ordersAsync = ref.watch(companyOrdersStreamProvider(companyId));
    final requestsAsync =
        ref.watch(companyServiceRequestsStreamProvider(companyId));

    if (ordersAsync.hasError && requestsAsync.hasError) {
      return AppErrorState(
        message: context.l10n.adminOrdersLoadFailed,
        onRetry: () {
          ref.invalidate(companyOrdersStreamProvider(companyId));
          ref.invalidate(companyServiceRequestsStreamProvider(companyId));
        },
      );
    }
    if (!ordersAsync.hasValue && !requestsAsync.hasValue) {
      return ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: const [AppSkeletonList()],
      );
    }

    final orders = ordersAsync.asData?.value ?? const <OrderEntity>[];
    final requests = requestsAsync.asData?.value ?? const <ServiceRequest>[];
    int countOf(CompanyOrdersSection section) =>
        orders.where((o) => sectionOfOrder(o) == section).length;

    final section = widget.section;
    final entries = <_Entry>[
      if (section != CompanyOrdersSection.services)
        for (final order in orders)
          if (section == CompanyOrdersSection.all ||
              sectionOfOrder(order) == section)
            _OrderEntry(order),
      if (section == CompanyOrdersSection.all ||
          section == CompanyOrdersSection.services)
        for (final request in requests) _RequestEntry(request),
    ]..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    final visible = searchRanked(
      entries,
      _query,
      (entry) => switch (entry) {
        _OrderEntry(:final order) => [
            SearchField(order.productName, weight: 3),
            SearchField(order.customerName, weight: 3),
            // The full id, so both the short number people read out and the
            // whole reference match (the short number is its prefix).
            SearchField(order.id, weight: 2),
            SearchField(order.contactPhone),
          ],
        _RequestEntry(:final request) => [
            SearchField(request.serviceName, weight: 3),
            SearchField(request.customerName, weight: 3),
            SearchField(request.id, weight: 2),
            SearchField(request.contactPhone),
          ],
      },
    );

    final l10n = context.l10n;
    const sections = CompanyOrdersSection.values;
    final labels = [
      for (final s in sections)
        switch (s) {
          CompanyOrdersSection.all =>
            l10n.adminFilterAll(orders.length + requests.length),
          CompanyOrdersSection.pickup => l10n.adminOrdersPickup(countOf(s)),
          CompanyOrdersSection.delivery =>
            l10n.adminOrdersDelivery(countOf(s)),
          CompanyOrdersSection.installation =>
            l10n.adminOrdersInstallation(countOf(s)),
          CompanyOrdersSection.services =>
            l10n.adminOrdersServices(requests.length),
        },
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.s16,
        AppSpacing.s12,
        AppSpacing.s16,
        AppSpacing.s24,
      ),
      children: [
        AppSearchField(
          hint: l10n.adminSearchOrders,
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: AppSpacing.s8),
        AppFilterChips(
          key: const ValueKey('company-orders-sections'),
          labels: labels,
          selectedIndex: sections.indexOf(section),
          onChanged: (index) => widget.onSectionChanged(sections[index]),
        ),
        const SizedBox(height: AppSpacing.s12),
        if (visible.isEmpty)
          AppEmptyState(
            icon: section == CompanyOrdersSection.services
                ? Icons.design_services_outlined
                : Icons.receipt_long_outlined,
            message: section == CompanyOrdersSection.services
                ? l10n.serviceRequestsEmptyCompany
                : l10n.adminNoOrdersToShow,
          )
        else
          for (final entry in visible) ...[
            switch (entry) {
              _OrderEntry(:final order) => _orderTile(order),
              _RequestEntry(:final request) =>
                ServiceRequestTile(request: request, asCompany: true),
            },
            const SizedBox(height: AppSpacing.s12),
          ],
      ],
    );
  }

  /// In the Installation section an order is shown and opened as a job.
  Widget _orderTile(OrderEntity order) {
    final asJob = widget.section == CompanyOrdersSection.installation;
    return CompanyOrderTile(
      order: order,
      showInstallationStatus: asJob,
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => asJob
              ? InstallationJobDetailsScreen(
                  companyId: widget.companyId,
                  orderId: order.id,
                )
              : CompanyOrderDetailsScreen(
                  companyId: widget.companyId,
                  orderId: order.id,
                ),
        ),
      ),
    );
  }
}
