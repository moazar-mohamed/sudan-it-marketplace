import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../../customer_dashboard/presentation/site/site_orders.dart';
import '../domain/report.dart';
import 'report_form_screen.dart';
import 'report_labels.dart';
import 'reports_providers.dart';

/// The person's own reports with where each stands and what the platform team
/// answered. Laid out as sictm.net's «بلاغاتي» (`pages/ReportsPages.tsx`).
class MyReportsScreen extends ConsumerWidget {
  const MyReportsScreen({super.key});

  Future<void> _openForm(BuildContext context) => Navigator.of(context).push(
        MaterialPageRoute<bool>(builder: (_) => const ReportFormScreen()),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final reports = ref.watch(myReportsProvider);
    final items = reports.asData?.value;
    final blocks = <Widget>[
      Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(child: SitePageTitle(l10n.myReportsTitle)),
          if (items != null && items.isNotEmpty)
            TextButton(
              key: const ValueKey('my-reports-new'),
              onPressed: () => _openForm(context),
              child: Text(l10n.reportFormTitle),
            ),
        ],
      ),
      ...reports.when(
        loading: () => [const AppSkeletonList(count: 2)],
        error: (_, _) => [
          AppErrorState(
            message: l10n.errorGeneric,
            onRetry: () => ref.invalidate(myReportsProvider),
          ),
        ],
        data: (items) => items.isEmpty
            ? [
                SiteEmptyState(
                  title: l10n.myReportsEmpty,
                  actionLabel: l10n.reportFormTitle,
                  onAction: () => _openForm(context),
                ),
              ]
            : [for (final report in items) _ReportCard(report: report)],
      ),
    ];
    return Scaffold(
      appBar: AppBar(),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < blocks.length; i++) ...[
                    if (i > 0) const SizedBox(height: 14),
                    blocks[i],
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

SiteTone _tone(ReportStatus status) => switch (status) {
      ReportStatus.newReport => SiteTone.warn,
      ReportStatus.inProgress => SiteTone.info,
      ReportStatus.closed => SiteTone.ok,
    };

/// One report (`.tile.report`): the subject with its status, the reason and the
/// date, what was written, and the platform team's answer underneath.
class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.report});

  final Report report;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final sent = MaterialLocalizations.of(context).formatMediumDate(report.createdAt);
    return SiteCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  report.subject,
                  style: AppTextStyles.bodyStrong.copyWith(fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 10),
              SiteTonePill(label: reportStatusLabel(context, report.status), tone: _tone(report.status)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${reportReasonLabel(context, report.reason)} · $sent',
            style: AppTextStyles.caption.copyWith(fontSize: 13, color: colors.textSecondary),
          ),
          const SizedBox(height: 10),
          Text(report.details, style: AppTextStyles.body.copyWith(height: 1.6)),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: report.hasReply ? colors.brandPrimarySubtle : colors.bgSubtle,
              borderRadius: BorderRadius.circular(14),
              border: BorderDirectional(
                start: BorderSide(
                  color: report.hasReply ? colors.textBrand : colors.borderDefault,
                  width: 3,
                ),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.reportReplyTitle,
                  style: AppTextStyles.captionStrong.copyWith(
                    fontSize: 13,
                    color: report.hasReply ? colors.textBrand : colors.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  report.hasReply ? report.resolution : l10n.reportNoReplyYet,
                  style: AppTextStyles.body.copyWith(
                    height: 1.6,
                    color: report.hasReply ? colors.textPrimary : colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
