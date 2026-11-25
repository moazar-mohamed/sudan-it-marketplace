import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/search_ranking.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/order_details_screen.dart';
import '../../../orders/presentation/order_labels.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../../../service_requests/domain/entities/service_request.dart';
import '../../../service_requests/presentation/service_request_details_screen.dart';
import '../../../service_requests/presentation/service_request_labels.dart';
import '../../../service_requests/presentation/service_request_providers.dart';
import 'site_detail_parts.dart';
import 'site_look.dart';

/// «طلباتي» as on sictm.net (`pages/OrdersPage.tsx`): products or services,
/// the page's own search, all / active / finished, and one card per order.

/// Which orders the chips show (`Filter`).
enum SiteOrdersFilter { all, active, done }

bool _orderFinished(OrderEntity o) =>
    o.orderStatus == OrderStatus.completed ||
    o.orderStatus == OrderStatus.cancelled;

/// A request the company finished, refused or that was withdrawn.
bool siteRequestFinished(ServiceRequest r) =>
    r.status == ServiceRequestStatus.completed ||
    r.status == ServiceRequestStatus.rejected ||
    r.status == ServiceRequestStatus.cancelled;

bool _wanted(SiteOrdersFilter filter, bool finished) =>
    filter == SiteOrdersFilter.all ||
    (filter == SiteOrdersFilter.done) == finished;

/// The customer's orders the chips and the search keep, in their own order
/// (`narrowOrders`: product, company, order number).
List<OrderEntity> siteNarrowOrders(
  List<OrderEntity> orders,
  SiteOrdersFilter filter,
  String query,
) {
  final kept = orders.where((o) => _wanted(filter, _orderFinished(o)));
  if (query.trim().isEmpty) return kept.toList();
  final hits = searchRanked(
    kept,
    query,
    (o) => [
      SearchField(o.productName, weight: 3),
      SearchField(o.companyName, weight: 2),
      SearchField(o.id),
    ],
  ).toSet();
  return kept.where(hits.contains).toList();
}

/// The same for service requests (`narrowRequests`).
List<ServiceRequest> siteNarrowRequests(
  List<ServiceRequest> requests,
  SiteOrdersFilter filter,
  String query,
) {
  final kept = requests.where((r) => _wanted(filter, siteRequestFinished(r)));
  if (query.trim().isEmpty) return kept.toList();
  final hits = searchRanked(
    kept,
    query,
    (r) => [
      SearchField(r.serviceName, weight: 3),
      SearchField(r.companyName, weight: 2),
      SearchField(r.id),
    ],
  ).toSet();
  return kept.where(hits.contains).toList();
}

/// The site's status colours (`.status.ok/.info/.warn/.off`).
enum SiteTone { ok, info, warn, off }

SiteTone siteOrderTone(OrderStatus status) => switch (status) {
  OrderStatus.processing => SiteTone.info,
  OrderStatus.outForDelivery => SiteTone.warn,
  OrderStatus.completed => SiteTone.ok,
  OrderStatus.cancelled => SiteTone.off,
};

SiteTone siteRequestTone(ServiceRequestStatus status) => switch (status) {
  ServiceRequestStatus.pending => SiteTone.warn,
  ServiceRequestStatus.accepted => SiteTone.info,
  ServiceRequestStatus.inProgress => SiteTone.info,
  ServiceRequestStatus.completed => SiteTone.ok,
  ServiceRequestStatus.rejected => SiteTone.off,
  ServiceRequestStatus.cancelled => SiteTone.off,
};

/// A status in the site's colours (`.status`).
class SiteTonePill extends StatelessWidget {
  const SiteTonePill({super.key, required this.label, required this.tone});

  final String label;
  final SiteTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (background, foreground) = switch (tone) {
      SiteTone.ok => (colors.successSubtle, colors.successText),
      SiteTone.info => (colors.infoSubtle, colors.textBrand),
      SiteTone.warn => (colors.warningSubtle, colors.warningText),
      SiteTone.off => (colors.errorSubtle, colors.errorText),
    };
    return SitePill(
      label: label,
      background: background,
      foreground: foreground,
      fontSize: 13,
    );
  }
}

/// Two or more equal choices on a grey track, the chosen one raised
/// (`.segment`), with an optional second line (`.segment.two-line`).
class SiteSegment<T> extends StatelessWidget {
  const SiteSegment({
    super.key,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final T value;

  /// (value, label, second line or null).
  final List<(T, String, String?)> options;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.bgSubtle,
        borderRadius: BorderRadius.circular(14),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < options.length; i++) ...[
              if (i > 0) const SizedBox(width: 4),
              Expanded(child: _option(context, options[i])),
            ],
          ],
        ),
      ),
    );
  }

  Widget _option(BuildContext context, (T, String, String?) option) {
    final colors = context.colors;
    final (v, label, second) = option;
    final on = v == value;
    return Semantics(
      button: true,
      selected: on,
      child: Material(
        color: on ? colors.surface : Colors.transparent,
        elevation: 0,
        borderRadius: BorderRadius.circular(11),
        shadowColor: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(11),
          onTap: () => onChanged(v),
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: on
                ? BoxDecoration(
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x24101828),
                        blurRadius: 4,
                        offset: Offset(0, 1),
                      ),
                    ],
                    color: colors.surface,
                  )
                : null,
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: AppTextStyles.bodyStrong.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: on ? colors.textPrimary : colors.textSecondary,
                  ),
                ),
                if (second != null)
                  Text(
                    second,
                    textAlign: TextAlign.center,
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: colors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A page's big title (`.page-title`).
class SitePageTitle extends StatelessWidget {
  const SitePageTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      child: Text(
        text,
        style: AppTextStyles.h1.copyWith(
          fontSize: 30,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

/// «طلباتي»: the customer's product orders and service requests.
class SiteOrdersPage extends ConsumerStatefulWidget {
  const SiteOrdersPage({super.key, this.onBrowse});

  /// «تصفّح المنتجات والخدمات» while there are no orders yet.
  final VoidCallback? onBrowse;

  @override
  ConsumerState<SiteOrdersPage> createState() => _SiteOrdersPageState();
}

class _SiteOrdersPageState extends ConsumerState<SiteOrdersPage> {
  bool _services = false;
  SiteOrdersFilter _filter = SiteOrdersFilter.all;
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final ordersAsync = ref.watch(customerOrdersStreamProvider);
    final requestsAsync = ref.watch(customerServiceRequestsStreamProvider);
    final orders = ordersAsync.asData?.value;
    final requests = requestsAsync.asData?.value;
    final query = _query.text;

    final children = <Widget>[SitePageTitle(l10n.navMyOrders)];
    if (ordersAsync.hasError || requestsAsync.hasError) {
      children.add(
        AppErrorState(
          title: l10n.ordersLoadFailed,
          message: l10n.errorGeneric,
          onRetry: () {
            ref.invalidate(customerOrdersStreamProvider);
            ref.invalidate(customerServiceRequestsStreamProvider);
          },
        ),
      );
    } else if (orders == null || requests == null) {
      children.add(const AppSkeletonList(count: 2));
    } else if (orders.isEmpty && requests.isEmpty) {
      children.add(
        SiteEmptyState(
          title: l10n.ordersEmptyTitle,
          message: l10n.ordersEmptyBody,
          actionLabel: widget.onBrowse == null ? null : l10n.siteBrowseAll,
          onAction: widget.onBrowse,
        ),
      );
    } else {
      final shownOrders = siteNarrowOrders(orders, _filter, query);
      final shownRequests = siteNarrowRequests(requests, _filter, query);
      final empty = _services ? shownRequests.isEmpty : shownOrders.isEmpty;
      children.addAll([
        SiteSegment<bool>(
          key: const ValueKey('orders-kind'),
          value: _services,
          options: [
            (false, l10n.siteOrdersProducts(orders.length), null),
            (true, l10n.siteOrdersServices(requests.length), null),
          ],
          onChanged: (v) => setState(() => _services = v),
        ),
        SitePageSearch(
          controller: _query,
          hint: l10n.siteOrdersSearch,
          onChanged: (_) => setState(() {}),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final (f, label) in [
              (SiteOrdersFilter.all, l10n.siteAll),
              (SiteOrdersFilter.active, l10n.siteOrdersActive),
              (SiteOrdersFilter.done, l10n.siteOrdersDone),
            ])
              SiteChip(
                key: ValueKey('orders-filter-${f.name}'),
                label: label,
                selected: _filter == f,
                onTap: () => setState(() => _filter = f),
              ),
          ],
        ),
        if (empty)
          SiteEmptyState(
            title: query.trim().isNotEmpty
                ? l10n.siteNoResultsHere(query.trim())
                : l10n.siteOrdersNone,
          ),
        if (_services)
          for (final r in shownRequests) _RequestCard(request: r)
        else
          for (final o in shownOrders) SiteOrderCard(order: o),
      ]);
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < children.length; i++) ...[
                  if (i > 0) const SizedBox(height: 16),
                  children[i],
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// An order or request card (`.tile.order-card`): «طلب #…» with its status,
/// the name, the company, then a line with a meta text and a price.
class _SiteOrderCardFrame extends StatelessWidget {
  const _SiteOrderCardFrame({
    super.key,
    required this.title,
    required this.status,
    required this.name,
    required this.company,
    required this.meta,
    this.price,
    this.extra,
    required this.onTap,
  });

  final String title;
  final Widget status;
  final String name;
  final String company;
  final String meta;
  final String? price;
  final Widget? extra;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final small = AppTextStyles.caption.copyWith(
      fontSize: 13,
      color: colors.textSecondary,
    );
    return Material(
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: colors.borderDefault),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: AppTextStyles.bodyStrong.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Flexible(child: status),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                name,
                style: AppTextStyles.bodyStrong.copyWith(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  height: 1.5,
                ),
              ),
              if (company.isNotEmpty) Text(company, style: small),
              ?extra,
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(child: Text(meta, style: small)),
                  if (price != null)
                    Text(
                      price!,
                      style: AppTextStyles.bodyStrong.copyWith(
                        fontWeight: FontWeight.w800,
                        color: colors.price,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// An order's card in «طلباتي» (`.tile.order-card`).
class SiteOrderCard extends StatelessWidget {
  const SiteOrderCard({super.key, required this.order});

  final OrderEntity order;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    return _SiteOrderCardFrame(
      key: ValueKey('site-order-${order.id}'),
      title: l10n.orderTitleNumber(order.shortId),
      status: SiteTonePill(
        label: order.orderStatus.label(l10n),
        tone: siteOrderTone(order.orderStatus),
      ),
      name: order.productName,
      company: order.companyName,
      extra: order.isAwaitingPaymentVerification
          ? Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: colors.warningSubtle,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  l10n.orderAwaitingConfirmation,
                  style: AppTextStyles.caption.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: colors.warningText,
                  ),
                ),
              ),
            )
          : null,
      meta: l10n.orderTotalAmount,
      price: sitePrice(context, order.totalAmount),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => OrderDetailsScreen(order: order),
        ),
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request});

  final ServiceRequest request;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return _SiteOrderCardFrame(
      key: ValueKey('site-request-${request.id}'),
      title: l10n.siteRequestTitleNumber(request.shortId),
      status: SiteTonePill(
        label: request.status.label(l10n),
        tone: siteRequestTone(request.status),
      ),
      name: request.serviceName,
      company: request.companyName,
      meta: siteLongDate(context, request.createdAt),
      price: request.price == null ? null : sitePrice(context, request.price!),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ServiceRequestDetailsScreen(
            requestId: request.id,
            asCompany: false,
          ),
        ),
      ),
    );
  }
}
