import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../technicians/domain/entities/technician.dart';
import '../../../technicians/presentation/technicians_providers.dart';
import '../company_admin_actions.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/status_badge.dart';
import 'technician_form_screen.dart';

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
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Deactivate technician'),
        content: Text(
          'Deactivate "${technician.fullName}"? '
          'They will no longer be available for new installation jobs.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Deactivate'),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }

    final error = await ref
        .read(companyAdminActionsProvider)
        .deactivateTechnician(technician.id);
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(error ?? 'Technician deactivated.'),
        backgroundColor: error == null ? null : AppColors.error,
      ),
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
        label: const Text('Add Technician'),
      ),
      body: techniciansAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => AdminErrorState(
          message: 'Could not load your technicians.',
          onRetry: () =>
              ref.invalidate(companyTechniciansStreamProvider(companyId)),
        ),
        data: (technicians) {
          if (technicians.isEmpty) {
            return ListView(
              children: const [
                AdminEmptyState(
                  icon: Icons.engineering_outlined,
                  message:
                      'You have not added any technicians yet.\nTap "Add Technician" to create your first one.',
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: technicians.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final technician = technicians[index];
              return _TechnicianTile(
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
              );
            },
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
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;

    return Material(
      color: colorScheme.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: colorScheme.onSurface.withValues(alpha: 0.08),
            ),
          ),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: colorScheme.primary.withValues(alpha: 0.12),
                foregroundColor: colorScheme.primary,
                child: const Icon(Icons.engineering_outlined),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      technician.fullName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (technician.phone.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        technician.phone,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurface.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    StatusBadge(
                      label: technician.isActive ? 'Active' : 'Inactive',
                      color: technician.isActive
                          ? AppColors.success
                          : AppColors.error,
                    ),
                  ],
                ),
              ),
              if (onDeactivate != null)
                IconButton(
                  tooltip: 'Deactivate technician',
                  icon: Icon(Icons.person_off_outlined, color: AppColors.error),
                  onPressed: onDeactivate,
                )
              else
                Icon(
                  Icons.chevron_right_rounded,
                  color: colorScheme.onSurface.withValues(alpha: 0.35),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
