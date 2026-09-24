import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../technicians/domain/entities/technician.dart';
import '../../../technicians/presentation/technicians_providers.dart';
import '../company_admin_actions.dart';
import '../widgets/status_badge.dart';
import 'technician_form_screen.dart';
import '../../../../core/localization/l10n_extension.dart';

class TechniciansTab extends ConsumerWidget {
  const TechniciansTab({super.key, required this.companyId});

  final String companyId;

  void _openAdd(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TechnicianFormScreen.add(companyId: companyId),
      ),
    );
  }

  Future<void> _confirmDeactivate(
    BuildContext context,
    WidgetRef ref,
    Technician technician,
  ) async {
    final confirmed = await showConfirmationDialog(
      context,
      title: context.l10n.adminDeactivateTechnician,
      body: context.l10n.adminDeactivateTechnicianBody(technician.fullName),
      confirmLabel: context.l10n.commonDeactivate,
      destructive: true,
    );
    if (!confirmed) {
      return;
    }

    final error = await ref
        .read(companyAdminActionsProvider)
        .deactivateTechnician(technician.id);
    if (!context.mounted) {
      return;
    }
    showAppSnackBar(
      context,
      error ?? context.l10n.adminTechnicianDeactivated,
      tone: error == null ? AppTone.success : AppTone.error,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final techniciansAsync =
        ref.watch(companyTechniciansStreamProvider(companyId));

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'company_add_technician',
        onPressed: () => _openAdd(context),
        icon: const Icon(Icons.add),
        label: Text(context.l10n.adminAddTechnician),
      ),
      body: techniciansAsync.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(AppSpacing.s16),
          children: const [AppSkeletonList()],
        ),
        error: (_, _) => AppErrorState(
          message: context.l10n.adminTechniciansLoadFailed,
          onRetry: () =>
              ref.invalidate(companyTechniciansStreamProvider(companyId)),
        ),
        data: (technicians) {
          if (technicians.isEmpty) {
            return ListView(
              children: [
                AppEmptyState(
                  icon: Icons.engineering_outlined,
                  message:
                      context.l10n.adminTechniciansEmpty,
                ),
              ],
            );
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.s16,
              AppSpacing.s16,
              AppSpacing.s16,
              96,
            ),
            children: [
              for (final technician in technicians) ...[
                _TechnicianTile(
                  technician: technician,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          TechnicianFormScreen.edit(technician: technician),
                    ),
                  ),
                  onDeactivate: technician.isActive
                      ? () => _confirmDeactivate(context, ref, technician)
                      : null,
                ),
                const SizedBox(height: AppSpacing.s12),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _TechnicianTile extends StatelessWidget {
  const _TechnicianTile({
    required this.technician,
    required this.onTap,
    this.onDeactivate,
  });

  final Technician technician;
  final VoidCallback onTap;
  final VoidCallback? onDeactivate;

  @override
  Widget build(BuildContext context) {
    return AppListCard(
      onTap: onTap,
      leading: const AppIconTile(
        icon: Icons.engineering_outlined,
        size: 44,
        radius: AppRadius.full,
      ),
      // The deactivate button replaces the chevron for an active technician.
      trailing: onDeactivate == null
          ? null
          : IconButton(
              tooltip: context.l10n.adminDeactivateTechnician,
              icon: const Icon(
                Icons.person_off_outlined,
                color: AppColors.errorText,
              ),
              onPressed: onDeactivate,
            ),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            technician.fullName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodyStrong,
          ),
          if (technician.phone.isNotEmpty)
            Text(
              technician.phone,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textDirection: TextDirection.ltr,
              style: AppTextStyles.caption
                  .copyWith(color: AppColors.textSecondary),
            ),
          const SizedBox(height: AppSpacing.s6),
          StatusBadge(
            label: technician.isActive
                ? context.l10n.adminActive
                : context.l10n.adminInactive,
            tone: technician.isActive ? AppTone.success : AppTone.neutral,
          ),
        ],
      ),
    );
  }
}
