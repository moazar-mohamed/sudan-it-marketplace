import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../categories/presentation/category_providers.dart';
import '../../../company_services/domain/entities/company_service.dart';
import '../../../company_services/presentation/company_service_providers.dart';
import '../../../service_requests/presentation/service_request_labels.dart';
import '../../../services/domain/entities/catalog_service.dart';
import '../../../services/presentation/service_providers.dart';
import '../company_admin_actions.dart';
import '../widgets/admin_section_card.dart';
import 'company_service_form_sheet.dart';
import 'own_service_form_sheet.dart';

/// Opens the form that creates a service owned by [companyId].
void showCreateOwnService(
  BuildContext context,
  WidgetRef ref,
  String companyId,
) {
  showOwnServiceForm(
    context,
    onSave: ({
      required categoryId,
      required name,
      required description,
      required price,
      required note,
    }) =>
        ref.read(companyAdminActionsProvider).createOwnService(
              companyId: companyId,
              categoryId: categoryId,
              name: name,
              description: description,
              price: price,
              note: note,
            ),
  );
}

/// "My Services": the services the company offers (its own, and ones it took
/// from the platform catalogue, each with its own optional price and note),
/// plus the catalogue services it can still add.
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
    // Only the platform's own catalogue is offered for adding: another
    // company's service is theirs to sell.
    final addable = catalogue
        .where(
          (service) =>
              !service.isCompanyOwned && !offeredIds.contains(service.id),
        )
        .toList();
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                context.l10n.adminServicesYours,
                style: textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (offered.isNotEmpty)
              FilledButton.icon(
                icon: const Icon(Icons.add),
                label: Text(context.l10n.adminServiceNew),
                onPressed: () => showCreateOwnService(context, ref, companyId),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (offered.isEmpty)
          AdminEmptyState(
            icon: Icons.design_services_outlined,
            message: context.l10n.adminServicesOfferedEmpty,
            action: FilledButton.icon(
              icon: const Icon(Icons.add),
              label: Text(context.l10n.adminServiceCreateFirst),
              onPressed: () => showCreateOwnService(context, ref, companyId),
            ),
          )
        else
          for (final link in offered) ...[
            _OfferedServiceCard(
              companyId: companyId,
              link: link,
              service: servicesById[link.serviceId],
            ),
            const SizedBox(height: 10),
          ],
        if (addable.isNotEmpty) ...[
          const SizedBox(height: 14),
          AdminSectionCard(
            title: context.l10n.adminServicesAvailable,
            children: [
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
                    style: TextButton.styleFrom(
                      foregroundColor: colorScheme.primary,
                    ),
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
      ],
    );
  }
}

class _OfferedServiceCard extends ConsumerWidget {
  const _OfferedServiceCard({
    required this.companyId,
    required this.link,
    required this.service,
  });

  final String companyId;
  final CompanyService link;
  final CatalogService? service;

  Future<void> _remove(BuildContext context, WidgetRef ref, String name) async {
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
    final actions = ref.read(companyAdminActionsProvider);
    final error = (service?.isCompanyOwned ?? false)
        ? await actions.removeOwnService(
            companyId: companyId,
            serviceId: link.serviceId,
          )
        : await actions.removeCompanyService(
            companyId: companyId,
            serviceId: link.serviceId,
          );
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error ?? context.l10n.adminServiceRemoved)),
      );
    }
  }

  void _edit(BuildContext context, WidgetRef ref, String name) {
    final actions = ref.read(companyAdminActionsProvider);
    final own = service;
    if (own != null && own.isCompanyOwned) {
      showOwnServiceForm(
        context,
        initialName: own.name,
        initialDescription: own.description,
        initialCategoryId: own.categoryId,
        initialPrice: link.price,
        initialNote: link.note,
        onSave: ({
          required categoryId,
          required name,
          required description,
          required price,
          required note,
        }) =>
            actions.updateOwnService(
              companyServiceId: link.id,
              serviceId: own.id,
              categoryId: categoryId,
              name: name,
              description: description,
              price: price,
              note: note,
            ),
      );
      return;
    }
    showCompanyServiceForm(
      context,
      serviceName: name,
      initialPrice: link.price,
      initialNote: link.note,
      onSave: (price, note) => actions.updateCompanyService(
        companyServiceId: link.id,
        price: price,
        note: note,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    final name = service?.name ?? link.serviceId;
    final price = link.price;
    final note = link.noteText;
    final categoryName = ref.watch(categoryNamesProvider)[service?.categoryId];
    final isOwn = service?.isCompanyOwned ?? false;

    return Material(
      color: colorScheme.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: () => _edit(context, ref, name),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: colorScheme.onSurface.withValues(alpha: 0.08),
            ),
          ),
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
                    if (categoryName != null || isOwn) ...[
                      const SizedBox(height: 2),
                      Text(
                        [
                          ?categoryName,
                          if (isOwn) context.l10n.adminServiceOwnBadge,
                        ].join(' · '),
                        style: textTheme.labelMedium?.copyWith(
                          color: colorScheme.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    // Nothing is shown when the company set no price.
                    if (price != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        formatServicePrice(price),
                        style: textTheme.bodyMedium?.copyWith(
                          color: colorScheme.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                    if (note != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        note,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurface.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              PopupMenuButton<String>(
                tooltip: context.l10n.commonEdit,
                onSelected: (value) {
                  if (value == 'edit') {
                    _edit(context, ref, name);
                  } else {
                    _remove(context, ref, name);
                  }
                },
                itemBuilder: (menuContext) => [
                  PopupMenuItem(
                    value: 'edit',
                    child: Text(context.l10n.commonEdit),
                  ),
                  PopupMenuItem(
                    value: 'remove',
                    child: Text(
                      context.l10n.commonRemove,
                      style: TextStyle(color: colorScheme.error),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
