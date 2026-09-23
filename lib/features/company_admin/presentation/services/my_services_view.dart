import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../company_services/domain/entities/company_service.dart';
import '../../../company_services/presentation/company_service_providers.dart';
import '../../../service_requests/presentation/service_request_labels.dart';
import '../../../services/domain/entities/catalog_service.dart';
import '../../../services/presentation/service_providers.dart';
import '../company_admin_actions.dart';
import '../widgets/admin_section_card.dart';
import 'company_service_form_sheet.dart';

/// "My Services": the catalogue services the company offers (with its own
/// optional price and note), and the catalogue services it can still add.
class MyServicesView extends ConsumerWidget {
  const MyServicesView({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offeredAsync = ref.watch(activeServicesForCompanyProvider(companyId));
    final catalogueAsync = ref.watch(marketplaceServicesProvider);
    // Every catalogue service (inactive ones included), so an offered service
    // that was later hidden from the catalogue still shows its name.
    final allServices = ref.watch(allServicesProvider(null)).asData?.value ??
        const <CatalogService>[];
    final servicesById = {
      for (final service in allServices) service.id: service,
    };

    if (offeredAsync.hasError || catalogueAsync.hasError) {
      return AdminErrorState(
        message: context.l10n.adminServicesLoadFailed,
        onRetry: () {
          ref.invalidate(activeServicesForCompanyProvider(companyId));
          ref.invalidate(activeServicesProvider(null));
        },
      );
    }
    final offered = offeredAsync.asData?.value;
    final catalogue = catalogueAsync.asData?.value;
    if (offered == null || catalogue == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final offeredIds = {for (final link in offered) link.serviceId};
    final addable =
        catalogue.where((service) => !offeredIds.contains(service.id)).toList();
    final mutedStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
        );

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        AdminSectionCard(
          title: context.l10n.adminServicesOffered,
          children: [
            if (offered.isEmpty)
              Text(context.l10n.adminServicesOfferedEmpty, style: mutedStyle),
            for (final link in offered)
              _OfferedServiceTile(
                companyId: companyId,
                link: link,
                service: servicesById[link.serviceId],
              ),
          ],
        ),
        const SizedBox(height: 16),
        AdminSectionCard(
          title: context.l10n.adminServicesAvailable,
          children: [
            if (addable.isEmpty)
              Text(
                catalogue.isEmpty
                    ? context.l10n.adminServicesCatalogueEmpty
                    : context.l10n.adminServicesAllAdded,
                style: mutedStyle,
              ),
            for (final service in addable)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(service.name),
                subtitle: service.description.trim().isEmpty
                    ? null
                    : Text(
                        service.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                trailing: TextButton.icon(
                  icon: const Icon(Icons.add),
                  label: Text(context.l10n.adminServiceAdd),
                  onPressed: () => showCompanyServiceForm(
                    context,
                    serviceName: service.name,
                    onSave: (price, note) => ref
                        .read(companyAdminActionsProvider)
                        .addCompanyService(
                          companyId: companyId,
                          serviceId: service.id,
                          price: price,
                          note: note,
                        ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _OfferedServiceTile extends ConsumerWidget {
  const _OfferedServiceTile({
    required this.companyId,
    required this.link,
    required this.service,
  });

  final String companyId;
  final CompanyService link;
  final CatalogService? service;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    final name = service?.name ?? link.serviceId;
    final price = link.price;
    final note = link.noteText;

    Future<void> remove() async {
      final ok = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(context.l10n.adminServiceRemoveTitle),
          content: Text(context.l10n.adminServiceRemoveBody(name)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(context.l10n.commonCancel),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(context.l10n.commonRemove),
            ),
          ],
        ),
      );
      if (ok != true || !context.mounted) return;
      final error = await ref
          .read(companyAdminActionsProvider)
          .removeCompanyService(companyId: companyId, serviceId: link.serviceId);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error ?? context.l10n.adminServiceRemoved)),
        );
      }
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                // Nothing is shown when the company set no price.
                if (price != null)
                  Text(
                    formatServicePrice(price),
                    style: textTheme.bodyMedium?.copyWith(
                      color: colorScheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                if (note != null)
                  Text(
                    note,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.65),
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            tooltip: context.l10n.commonEdit,
            icon: const Icon(Icons.edit_outlined),
            onPressed: () => showCompanyServiceForm(
              context,
              serviceName: name,
              initialPrice: price,
              initialNote: link.note,
              onSave: (price, note) => ref
                  .read(companyAdminActionsProvider)
                  .updateCompanyService(
                    companyServiceId: link.id,
                    price: price,
                    note: note,
                  ),
            ),
          ),
          IconButton(
            tooltip: context.l10n.commonRemove,
            icon: Icon(Icons.delete_outline, color: colorScheme.error),
            onPressed: remove,
          ),
        ],
      ),
    );
  }
}
