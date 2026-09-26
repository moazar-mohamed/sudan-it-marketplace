import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/arabic_text.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../technicians/domain/entities/technician.dart';

/// Opens the technician chooser: a sheet listing the company's technicians as
/// tappable cards (avatar, name, phone), the one already assigned marked, with
/// a search box when the list is long. Returns the chosen technician, or null
/// when it is dismissed.
Future<Technician?> showTechnicianPicker(
  BuildContext context, {
  required List<Technician> technicians,
  required String? assignedId,
}) {
  return showModalBottomSheet<Technician>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: technicians.length > 4 ? 0.7 : 0.5,
      maxChildSize: 0.9,
      builder: (_, controller) => _TechnicianSheet(
        technicians: technicians,
        assignedId: assignedId,
        scrollController: controller,
      ),
    ),
  );
}

/// More technicians than this and the sheet offers a search box.
const technicianSearchThreshold = 6;

class _TechnicianSheet extends StatefulWidget {
  const _TechnicianSheet({
    required this.technicians,
    required this.assignedId,
    required this.scrollController,
  });

  final List<Technician> technicians;
  final String? assignedId;
  final ScrollController scrollController;

  @override
  State<_TechnicianSheet> createState() => _TechnicianSheetState();
}

class _TechnicianSheetState extends State<_TechnicianSheet> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Technician> get _shown {
    final query = normalizeSearchText(_query);
    if (query.isEmpty) return widget.technicians;
    return [
      for (final technician in widget.technicians)
        if (normalizeSearchText(technician.fullName).contains(query) ||
            technician.phone.contains(query))
          technician,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final shown = _shown;
    return ListView(
      controller: widget.scrollController,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.s16,
        0,
        AppSpacing.s16,
        AppSpacing.s24,
      ),
      children: [
        Text(context.l10n.adminAssignTechnician, style: AppTextStyles.h2),
        const SizedBox(height: AppSpacing.s4),
        Text(
          context.l10n.adminPickTechnicianHint,
          style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.s16),
        if (widget.technicians.length > technicianSearchThreshold) ...[
          AppSearchField(
            key: const ValueKey('technician-search'),
            controller: _searchController,
            hint: context.l10n.adminTechnicianSearchHint,
            onChanged: (value) => setState(() => _query = value),
            onCleared: () => setState(() {
              _searchController.clear();
              _query = '';
            }),
          ),
          const SizedBox(height: AppSpacing.s12),
        ],
        if (shown.isEmpty)
          Padding(
            padding: const EdgeInsets.all(AppSpacing.s24),
            child: Text(
              context.l10n.adminTechnicianNoMatch,
              textAlign: TextAlign.center,
              style: AppTextStyles.body.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          )
        else
          for (final technician in shown) ...[
            _TechnicianTile(
              key: ValueKey('technician-${technician.id}'),
              technician: technician,
              assigned: technician.id == widget.assignedId,
              onTap: () => Navigator.of(context).pop(technician),
            ),
            const SizedBox(height: AppSpacing.s8),
          ],
      ],
    );
  }
}

class _TechnicianTile extends StatelessWidget {
  const _TechnicianTile({
    super.key,
    required this.technician,
    required this.assigned,
    required this.onTap,
  });

  final Technician technician;
  final bool assigned;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final phone = technician.phone.trim();
    return Material(
      color: assigned ? AppColors.brandPrimarySubtle : AppColors.bgSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        side: BorderSide(
          color: assigned ? AppColors.primary : AppColors.borderDefault,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSize.touchMin + 16),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.s12,
              vertical: AppSpacing.s8,
            ),
            child: Row(
              children: [
                AppAvatar(name: technician.fullName),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        technician.fullName,
                        style: AppTextStyles.body.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (phone.isNotEmpty)
                        Directionality(
                          textDirection: TextDirection.ltr,
                          child: Text(
                            phone,
                            style: AppTextStyles.caption.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                if (assigned)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.check_circle_rounded,
                        color: AppColors.primary,
                        size: AppSize.iconMd,
                      ),
                      const SizedBox(width: AppSpacing.s4),
                      Text(
                        context.l10n.adminTechnicianCurrent,
                        style: AppTextStyles.labelMedium.copyWith(
                          color: AppColors.textBrand,
                        ),
                      ),
                    ],
                  )
                else
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textSecondary,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
