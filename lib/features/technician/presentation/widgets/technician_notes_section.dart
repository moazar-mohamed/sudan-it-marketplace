import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../orders/domain/entities/order_entity.dart';
import '../../domain/technician_note.dart';
import '../technician_actions.dart';
import '../technician_format.dart';
import '../technician_notes_providers.dart';
import 'technician_widgets.dart';

/// The technician's notes on one job. With [editable] the technician can add
/// and delete their own notes; the company sees the same list read-only. The
/// customer never does: the notes live apart from the order.
class TechnicianNotesSection extends ConsumerStatefulWidget {
  const TechnicianNotesSection({
    super.key,
    required this.order,
    this.editable = false,
  });

  final OrderEntity order;
  final bool editable;

  @override
  ConsumerState<TechnicianNotesSection> createState() =>
      _TechnicianNotesSectionState();
}

class _TechnicianNotesSectionState
    extends ConsumerState<TechnicianNotesSection> {
  final _controller = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _saving) return;
    setState(() => _saving = true);
    final error =
        await ref.read(technicianActionsProvider).addNote(widget.order, text: text);
    if (!mounted) return;
    setState(() => _saving = false);
    if (error != null) {
      showAppSnackBar(context, error, tone: AppTone.error);
      return;
    }
    _controller.clear();
  }

  Future<void> _delete(TechnicianNote note) async {
    final error =
        await ref.read(technicianActionsProvider).deleteNote(widget.order, note);
    if (!mounted || error == null) return;
    showAppSnackBar(context, error, tone: AppTone.error);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final notesAsync = ref.watch(technicianNotesProvider(widget.order.id));
    final notes = notesAsync.asData?.value ?? const <TechnicianNote>[];
    final canWrite = widget.editable && !widget.order.isCancelled;

    // The company has nothing to show when the technician wrote nothing.
    if (!widget.editable && notes.isEmpty) return const SizedBox.shrink();

    return TechnicianSectionCard(
      title: widget.editable ? l10n.tjNotesTitle : l10n.tjTechnicianNotesTitle,
      children: [
        if (canWrite) ...[
          TextField(
            key: const ValueKey('technician-note-input'),
            controller: _controller,
            minLines: 1,
            maxLines: 4,
            maxLength: TechnicianNote.maxLength,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: l10n.tjNotesHint,
              counterText: '',
              suffixIcon: IconButton(
                key: const ValueKey('technician-note-add'),
                tooltip: l10n.tjNotesAdd,
                icon: _saving
                    ? const AppSpinner()
                    : const Icon(Icons.add_circle_outline),
                onPressed: _saving ? null : _add,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.s4),
          Text(
            l10n.tjNotesVisibility,
            style: AppTextStyles.labelSmall
                .copyWith(color: context.colors.textSecondary),
          ),
        ],
        if (notes.isEmpty && canWrite)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.s8),
            child: Text(
              l10n.tjNotesEmpty,
              style: AppTextStyles.caption
                  .copyWith(color: context.colors.textSecondary),
            ),
          ),
        for (final note in notes)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.s12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(note.text, style: AppTextStyles.body),
                      const SizedBox(height: AppSpacing.s2),
                      Text(
                        [
                          TechnicianFormat.date(note.createdAt),
                          if (note.kind == TechnicianNoteKind.completion)
                            l10n.tjNoteCompletion,
                        ].join(' • '),
                        textDirection: TextDirection.ltr,
                        style: AppTextStyles.labelSmall
                            .copyWith(color: context.colors.textSecondary),
                      ),
                    ],
                  ),
                ),
                if (canWrite)
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    tooltip: l10n.tjNoteDelete,
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => _delete(note),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
