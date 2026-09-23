import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../company_admin/presentation/widgets/admin_section_card.dart';
import 'service_request_providers.dart';
import 'widgets/service_request_tile.dart';

/// The signed-in customer's service requests, or every request sent to
/// [companyId] when [asCompany] is true.
class ServiceRequestsList extends ConsumerWidget {
  const ServiceRequestsList({
    super.key,
    required this.asCompany,
    this.companyId = '',
  });

  final bool asCompany;
  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = asCompany
        ? companyServiceRequestsStreamProvider(companyId)
        : customerServiceRequestsStreamProvider;
    return ref.watch(provider).when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => AdminErrorState(
            message: context.l10n.serviceRequestsLoadFailed,
            onRetry: () => ref.invalidate(provider),
          ),
          data: (requests) {
            if (requests.isEmpty) {
              return ListView(
                children: [
                  AdminEmptyState(
                    icon: Icons.miscellaneous_services_outlined,
                    message: asCompany
                        ? context.l10n.serviceRequestsEmptyCompany
                        : context.l10n.serviceRequestsEmptyCustomer,
                  ),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              itemCount: requests.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, index) => ServiceRequestTile(
                request: requests[index],
                asCompany: asCompany,
              ),
            );
          },
        );
  }
}
