import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../orders/presentation/orders_providers.dart';
import '../widgets/admin_section_card.dart';
import '../widgets/company_order_tile.dart';
import 'installation_job_details_screen.dart';
import '../../../../core/localization/l10n_extension.dart';

/// Installation jobs are product orders that include installation.
class InstallationJobsTab extends ConsumerWidget {
  const InstallationJobsTab({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(companyOrdersStreamProvider(companyId));

    return ordersAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => AdminErrorState(
        message: context.l10n.adminInstallationJobsLoadFailed,
        onRetry: () => ref.invalidate(companyOrdersStreamProvider(companyId)),
      ),
      data: (orders) {
        final jobs = orders.where((o) => o.installationSelected).toList();
        if (jobs.isEmpty) {
          return ListView(
            children: [
              AdminEmptyState(
                icon: Icons.handyman_outlined,
                message:
                    context.l10n.adminInstallationJobsEmpty,
              ),
            ],
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          itemCount: jobs.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (context, index) => CompanyOrderTile(
            order: jobs[index],
            showInstallationStatus: true,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => InstallationJobDetailsScreen(
                  companyId: companyId,
                  orderId: jobs[index].id,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
