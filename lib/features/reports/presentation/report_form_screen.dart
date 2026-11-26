import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../customer_dashboard/presentation/site/site_detail_parts.dart';
import '../../customer_dashboard/presentation/site/site_look.dart';
import '../../customer_dashboard/presentation/site/site_orders.dart';
import '../domain/report.dart';
import 'report_labels.dart';
import 'reports_providers.dart';

/// "Report a problem": what it is about, a subject, what happened and, if it
/// concerns one, the order number. The platform team answers under My reports.
class ReportFormScreen extends ConsumerStatefulWidget {
  const ReportFormScreen({super.key});

  @override
  ConsumerState<ReportFormScreen> createState() => _ReportFormScreenState();
}

class _ReportFormScreenState extends ConsumerState<ReportFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subject = TextEditingController();
  final _details = TextEditingController();
  final _order = TextEditingController();
  ReportReason _reason = ReportReason.orderProblem;
  bool _submitting = false;

  @override
  void dispose() {
    _subject.dispose();
    _details.dispose();
    _order.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting || !(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    final error = await ref.read(reportActionsProvider).submit(
          ReportDraft(
            reason: _reason,
            subject: _subject.text,
            details: _details.text,
            orderRef: _order.text,
          ),
        );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error);
      return;
    }
    showAppSnackBar(context, context.l10n.reportSent, tone: AppTone.success);
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.colors;
    // Laid out as sictm.net's «الإبلاغ عن مشكلة» (`pages/ReportsPages.tsx`).
    final blocks = <Widget>[
      SitePageTitle(l10n.reportFormTitle),
      SiteTile(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.reportIntro,
              style: AppTextStyles.body.copyWith(
                height: 1.6,
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: 16),
            SiteTileTitle(l10n.reportReasonLabel),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final reason in ReportReason.values)
                  SiteChip(
                    key: ValueKey('report-reason-${reason.value}'),
                    label: reportReasonLabel(context, reason),
                    selected: _reason == reason,
                    small: true,
                    onTap: () {
                      if (!_submitting) setState(() => _reason = reason);
                    },
                  ),
              ],
            ),
          ],
        ),
      ),
      SiteTile(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppTextField(
              key: const ValueKey('report-subject'),
              label: l10n.reportSubjectLabel,
              hint: l10n.reportSubjectHint,
              controller: _subject,
              maxLength: reportSubjectMax,
              textInputAction: TextInputAction.next,
              validator: (value) => (value?.trim().isEmpty ?? true)
                  ? l10n.reportSubjectRequired
                  : null,
            ),
            const SizedBox(height: 12),
            AppTextField(
              key: const ValueKey('report-details'),
              label: l10n.reportDetailsLabel,
              hint: l10n.reportDetailsHint,
              controller: _details,
              minLines: 4,
              maxLines: 8,
              maxLength: reportDetailsMax,
              textInputAction: TextInputAction.newline,
              validator: (value) => (value?.trim().isEmpty ?? true)
                  ? l10n.reportDetailsRequired
                  : null,
            ),
            const SizedBox(height: 12),
            AppTextField(
              key: const ValueKey('report-order'),
              label: l10n.reportOrderLabel,
              controller: _order,
              maxLength: reportOrderRefMax,
              optional: true,
              textInputAction: TextInputAction.done,
            ),
          ],
        ),
      ),
      AppButton.primary(
        key: const ValueKey('report-submit'),
        label: l10n.reportSubmit,
        loading: _submitting,
        expand: true,
        onPressed: _submit,
      ),
    ];
    return Scaffold(
      appBar: AppBar(),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 48),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 680),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < blocks.length; i++) ...[
                      if (i > 0) const SizedBox(height: 16),
                      blocks[i],
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
