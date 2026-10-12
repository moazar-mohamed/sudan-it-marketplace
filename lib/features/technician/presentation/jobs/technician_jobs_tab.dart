import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/domain/entities/order_entity.dart';
import '../../../orders/presentation/orders_providers.dart';
import '../widgets/technician_job_tile.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/phone_number.dart';
import '../../../../core/utils/search_ranking.dart';
import '../../../../l10n/app_localizations.dart';
import '../technician_format.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../technician_job_helpers.dart';
import '../widgets/technician_widgets.dart';
import 'technician_job_details_screen.dart';
import '../../../../core/localization/l10n_extension.dart';

enum _JobFilter { all, open, done, cancelled }

enum _JobSort { newest, nearest }

/// Installation jobs assigned to the signed-in technician: searchable,
/// filterable, and grouped into open, completed and cancelled.
class TechnicianJobsTab extends ConsumerStatefulWidget {
  const TechnicianJobsTab({super.key, required this.technicianId});

  final String technicianId;

  @override
  ConsumerState<TechnicianJobsTab> createState() => _TechnicianJobsTabState();
}

class _TechnicianJobsTabState extends ConsumerState<TechnicianJobsTab> {
  final _searchController = TextEditingController();
  _JobFilter _filter = _JobFilter.all;
  _JobSort _sort = _JobSort.newest;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _matchesFilter(OrderEntity job) => switch (_filter) {
        _JobFilter.all => true,
        _JobFilter.open => isOpenJob(job),
        _JobFilter.done => job.orderStatus == OrderStatus.completed,
        _JobFilter.cancelled => job.isCancelled,
      };

  /// What a job can be found by: the product and the customer first, then the
  /// phone (in every way it is dialled), the job number, the address and the
  /// status in words ("cancelled", "waiting for payment", "completed").
  List<SearchField> _fieldsOf(OrderEntity job, AppLocalizations l10n) {
    final waitingPayment = !job.isCancelled &&
        job.orderStatus != OrderStatus.completed &&
        job.paymentStatus != PaymentStatus.confirmed;
    return [
      SearchField(job.productName, weight: 3),
      SearchField(TechnicianFormat.customer(job, l10n), weight: 3),
      SearchField(phoneSearchForms(job.contactPhone).join(' '), weight: 2),
      SearchField('${job.shortId} ${job.id}', weight: 2),
      SearchField(job.deliveryText ?? '', weight: 1),
      SearchField(
        [
          TechnicianFormat.jobStatusLabel(job, l10n),
          if (job.isCancelled) l10n.tjCancelledTag,
          if (waitingPayment) l10n.tjAwaitingPaymentTag,
        ].join(' '),
        weight: 1,
      ),
    ];
  }

  void _open(OrderEntity job) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TechnicianJobDetailsScreen(
          technicianId: widget.technicianId,
          orderId: job.id,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final jobsAsync =
        ref.watch(technicianOrdersStreamProvider(widget.technicianId));
    final position = ref.watch(technicianPositionProvider).asData?.value;
    final l10n = context.l10n;

    return jobsAsync.when(
      loading: () => ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: const [AppSkeletonList()],
      ),
      error: (_, _) => TechnicianErrorState(
        message: l10n.techJobsLoadFailed,
        onRetry: () =>
            ref.invalidate(technicianOrdersStreamProvider(widget.technicianId)),
      ),
      data: (jobs) {
        if (jobs.isEmpty) {
          return ListView(
            children: [
              TechnicianEmptyState(
                icon: Icons.handyman_outlined,
                message: l10n.techNoJobsAssigned,
              ),
            ],
          );
        }

        final counts = {
          _JobFilter.all: jobs.length,
          _JobFilter.open: jobs.where(isOpenJob).length,
          _JobFilter.done:
              jobs.where((j) => j.orderStatus == OrderStatus.completed).length,
          _JobFilter.cancelled: jobs.where((j) => j.isCancelled).length,
        };
        final query = _searchController.text.trim();
        final inFilter = jobs.where(_matchesFilter).toList();
        // A search puts the best match first, whatever the sort chip says.
        final shown = query.isEmpty
            ? inFilter
            : searchRanked(inFilter, query, (job) => _fieldsOf(job, l10n));

        int compare(OrderEntity a, OrderEntity b) {
          if (_sort == _JobSort.nearest) {
            final aKm = jobDistanceKm(a, position);
            final bKm = jobDistanceKm(b, position);
            if (aKm != null && bKm != null) return aKm.compareTo(bKm);
            if (aKm != null) return -1;
            if (bKm != null) return 1;
          }
          return b.createdAt.compareTo(a.createdAt);
        }

        if (query.isEmpty) shown.sort(compare);
        final open = shown.where(isOpenJob).toList();
        final done =
            shown.where((j) => j.orderStatus == OrderStatus.completed).toList();
        final cancelled = shown.where((j) => j.isCancelled).toList();

        String filterLabel(_JobFilter f) {
          final n = counts[f]!;
          return switch (f) {
            _JobFilter.all => l10n.tjFilterAll(n),
            _JobFilter.open => l10n.tjFilterOpen(n),
            _JobFilter.done => l10n.tjFilterDone(n),
            _JobFilter.cancelled => l10n.tjFilterCancelled(n),
          };
        }

        // With a search the best matches stay in one list, in their order.
        List<Widget> section(String title, List<OrderEntity> items) {
          if (items.isEmpty) return const [];
          return [
            Padding(
              padding: const EdgeInsets.only(
                top: AppSpacing.s8,
                bottom: AppSpacing.s8,
              ),
              child: Text(
                title,
                style: AppTextStyles.captionStrong
                    .copyWith(color: context.colors.textSecondary),
              ),
            ),
            for (final job in items)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.s12),
                child: TechnicianJobTile(
                  order: job,
                  distanceKm: jobDistanceKm(job, position),
                  highlight: query.isEmpty ? null : query,
                  onTap: () => _open(job),
                ),
              ),
          ];
        }

        return AppCenteredList(
          children: [
            TextField(
              controller: _searchController,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: l10n.tjSearchHint,
                prefixIcon: const Icon(Icons.search),
                suffixIcon: query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => setState(_searchController.clear),
                      ),
                isDense: true,
              ),
            ),
            const SizedBox(height: AppSpacing.s12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final f in _JobFilter.values) ...[
                    ChoiceChip(
                      label: Text(filterLabel(f)),
                      selected: _filter == f,
                      onSelected: (_) => setState(() => _filter = f),
                    ),
                    const SizedBox(width: AppSpacing.s8),
                  ],
                  const SizedBox(width: AppSpacing.s8),
                  ChoiceChip(
                    avatar: const Icon(Icons.swap_vert, size: 16),
                    label: Text(
                      _sort == _JobSort.newest
                          ? l10n.tjSortNewest
                          : l10n.tjSortNearest,
                    ),
                    selected: false,
                    onSelected: (_) => setState(
                      () => _sort = _sort == _JobSort.newest
                          ? _JobSort.nearest
                          : _JobSort.newest,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.s8),
            if (shown.isEmpty) ...[
              TechnicianEmptyState(
                icon: Icons.search_off,
                message: l10n.tjNoMatches,
              ),
              if (query.isNotEmpty)
                Builder(builder: (context) {
                  // "Did you mean": from the names and places of all jobs.
                  final guess = suggestCorrection(query, [
                    for (final job in jobs) ...[
                      job.productName,
                      job.customerName,
                      job.deliveryText ?? '',
                    ],
                  ]);
                  if (guess == null) return const SizedBox.shrink();
                  return ListTile(
                    key: const ValueKey('technician-did-you-mean'),
                    leading: Icon(
                      Icons.lightbulb_outline_rounded,
                      color: context.colors.iconBrand,
                    ),
                    title: Text(
                      l10n.searchDidYouMean(guess),
                      style: AppTextStyles.bodyStrong
                          .copyWith(color: context.colors.textBrand),
                    ),
                    onTap: () => setState(() => _searchController.text = guess),
                  );
                }),
            ] else if (query.isNotEmpty)
              // One list in relevance order, not split in sections.
              ...[
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.s8),
                  child: Text(
                    l10n.tjSearchResults(shown.length),
                    key: const ValueKey('technician-search-count'),
                    style: AppTextStyles.captionStrong
                        .copyWith(color: context.colors.textSecondary),
                  ),
                ),
                for (final job in shown)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.s12),
                    child: TechnicianJobTile(
                      order: job,
                      distanceKm: jobDistanceKm(job, position),
                      highlight: query,
                      onTap: () => _open(job),
                    ),
                  ),
              ]
            else ...[
              ...section(l10n.tjSectionOpen, open),
              ...section(l10n.tjSectionDone, done),
              ...section(l10n.tjSectionCancelled, cancelled),
            ],
          ],
        );
      },
    );
  }
}
