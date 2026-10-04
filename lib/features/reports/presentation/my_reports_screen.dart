import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../domain/report.dart';
import 'report_form_screen.dart';
import 'report_labels.dart';
import 'reports_providers.dart';

/// The person's own reports with where each stands and what the platform team
/// answered.
class MyReportsScreen extends ConsumerWidget {
  const MyReportsScreen({super.key});

  Future<void> _openForm(BuildContext context) => Navigator.of(context).push(
        MaterialPageRoute<bool>(builder: (_) => const ReportFormScreen()),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final reports = ref.watch(myReportsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.myReportsTitle)),
      body: reports.when(
        loading: () => const Center(child: AppSpinner()),
        error: (_, _) => AppErrorState(
          message: l10n.errorGeneric,
          onRetry: () => ref.invalidate(myReportsProvider),
        ),
        data: (items) => items.isEmpty
            ? AppEmptyState(
                icon: Icons.flag_outlined,
                message: l10n.myReportsEmpty,
                expandVertically: true,
                action: AppButton.primary(
                  label: l10n.reportFormTitle,
                  onPressed: () => _openForm(context),
                ),
              )
            : AppCenteredList(
                children: [
                  for (final report in items) ...[
                    _ReportCard(report: report),
                    const SizedBox(height: AppSpacing.s12),
                  ],
                ],
              ),
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.report});

  final Report report;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    final sent =
        MaterialLocalizations.of(context).formatShortDate(report.createdAt);
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(report.subject, style: AppTextStyles.bodyStrong),
              ),
              const SizedBox(width: AppSpacing.s8),
              StatusChip(
                label: reportStatusLabel(context, report.status),
                tone: reportStatusTone(report.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s4),
          Text(
            '${reportReasonLabel(context, report.reason)} · $sent',
            style: AppTextStyles.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.s8),
          Text(report.details, style: AppTextStyles.body),
          const SizedBox(height: AppSpacing.s12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.s12),
            decoration: BoxDecoration(
              color: colors.bgMuted,
              borderRadius: AppRadius.smAll,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.reportReplyTitle,
                  style: AppTextStyles.captionStrong
                      .copyWith(color: colors.textSecondary),
                ),
                const SizedBox(height: AppSpacing.s4),
                Text(
                  report.hasReply ? report.resolution : l10n.reportNoReplyYet,
                  style: AppTextStyles.body.copyWith(
                    color: report.hasReply
                        ? colors.textPrimary
                        : colors.textSecondary,
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
