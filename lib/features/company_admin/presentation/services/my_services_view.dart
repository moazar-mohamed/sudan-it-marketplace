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
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
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
      return AppErrorState(
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
      return const AppLoadingState();
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

    return AppCenteredList(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                context.l10n.adminServicesYours,
                style: AppTextStyles.h3,
              ),
            ),
            if (offered.isNotEmpty)
              AppButton.primary(
                icon: Icons.add,
                label: context.l10n.adminServiceNew,
                size: AppButtonSize.medium,
                onPressed: () => showCreateOwnService(context, ref, companyId),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.s12),
        if (offered.isEmpty)
          AppEmptyState(
            icon: Icons.design_services_outlined,
            message: context.l10n.adminServicesOfferedEmpty,
            action: AppButton.primary(
              icon: Icons.add,
              label: context.l10n.adminServiceCreateFirst,
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
            const SizedBox(height: AppSpacing.s12),
          ],
        if (addable.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s12),
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
                  trailing: AppButton.text(
                    icon: Icons.add,
                    label: context.l10n.adminServiceAdd,
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
    final ok = await showConfirmationDialog(
      context,
      title: context.l10n.adminServiceRemoveTitle,
      body: context.l10n.adminServiceRemoveBody(name),
      confirmLabel: context.l10n.commonRemove,
      destructive: true,
    );
    if (!ok || !context.mounted) return;
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
      showAppSnackBar(
        context,
        error ?? context.l10n.adminServiceRemoved,
        tone: error == null ? AppTone.success : AppTone.error,
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
    final name = service?.name ?? link.serviceId;
    final price = link.price;
    final note = link.noteText;
    final categoryName = ref.watch(categoryNamesProvider)[service?.categoryId];
    final isOwn = service?.isCompanyOwned ?? false;

    return AppCard(
      onTap: () => _edit(context, ref, name),
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.s16,
        AppSpacing.s12,
        AppSpacing.s4,
        AppSpacing.s12,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: AppTextStyles.bodyStrong),
                if (categoryName != null || isOwn)
                  Text(
                    [
                      ?categoryName,
                      if (isOwn) context.l10n.adminServiceOwnBadge,
                    ].join(' · '),
                    style: AppTextStyles.captionStrong
                        .copyWith(color: AppColors.textBrand),
                  ),
                // Nothing is shown when the company set no price.
                if (price != null)
                  Text(
                    formatServicePrice(price),
                    style: AppTextStyles.bodyStrong
                        .copyWith(color: AppColors.textBrand),
                  ),
                if (note != null)
                  Text(
                    note,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.caption
                        .copyWith(color: AppColors.textSecondary),
                  ),
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
                  style: const TextStyle(color: AppColors.errorText),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
