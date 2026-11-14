import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_widgets.dart';
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
    return Scaffold(
      appBar: AppBar(title: Text(l10n.reportFormTitle)),
      body: Form(
        key: _formKey,
        child: AppCenteredList(
          children: [
            Text(
              l10n.reportIntro,
              style: AppTextStyles.body.copyWith(color: colors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.s16),
            Text(l10n.reportReasonLabel, style: AppTextStyles.bodyStrong),
            const SizedBox(height: AppSpacing.s8),
            Wrap(
              spacing: AppSpacing.s8,
              runSpacing: AppSpacing.s8,
              children: [
                for (final reason in ReportReason.values)
                  ChoiceChip(
                    key: ValueKey('report-reason-${reason.value}'),
                    label: Text(reportReasonLabel(context, reason)),
                    selected: _reason == reason,
                    onSelected: _submitting
                        ? null
                        : (_) => setState(() => _reason = reason),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.s16),
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
            const SizedBox(height: AppSpacing.s12),
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
            const SizedBox(height: AppSpacing.s12),
            AppTextField(
              key: const ValueKey('report-order'),
              label: l10n.reportOrderLabel,
              controller: _order,
              maxLength: reportOrderRefMax,
              optional: true,
              textInputAction: TextInputAction.done,
            ),
            const SizedBox(height: AppSpacing.s24),
            AppButton.primary(
              key: const ValueKey('report-submit'),
              label: l10n.reportSubmit,
              loading: _submitting,
              expand: true,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
