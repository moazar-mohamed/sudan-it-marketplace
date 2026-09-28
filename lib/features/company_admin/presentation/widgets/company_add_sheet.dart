import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../offers/offer_form_screen.dart';
import '../products/product_form_screen.dart';
import '../services/my_services_view.dart';
import '../technicians/technician_form_screen.dart';

enum _AddChoice { product, offer, service, technician }

/// The bottom bar's Add button: one sheet for everything the company can
/// create - a product, an offer on a product, a service, a technician.
Future<void> showCompanyAddSheet(
  BuildContext context,
  WidgetRef ref,
  String companyId,
) async {
  final l10n = context.l10n;
  final choice = await showModalBottomSheet<_AddChoice>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.s16,
          0,
          AppSpacing.s16,
          AppSpacing.s16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.adminAddNewTitle, style: AppTextStyles.h2),
            const SizedBox(height: AppSpacing.s12),
            for (final (choice, icon, label) in [
              (_AddChoice.product, Icons.inventory_2_outlined, l10n.adminAddProduct),
              (_AddChoice.offer, Icons.local_offer_outlined, l10n.adminAddOffer),
              (_AddChoice.service, Icons.design_services_outlined, l10n.adminAddService),
              (_AddChoice.technician, Icons.engineering_outlined, l10n.adminAddTechnician),
            ])
              InkWell(
                key: ValueKey('company-add-${choice.name}'),
                borderRadius: AppRadius.smAll,
                onTap: () => Navigator.of(sheetContext).pop(choice),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 56),
                  child: Row(
                    children: [
                      AppIconTile(icon: icon, size: 40, iconSize: AppSize.iconMd),
                      const SizedBox(width: AppSpacing.s12),
                      Expanded(
                        child: Text(label, style: AppTextStyles.bodyStrong),
                      ),
                      Icon(
                        Icons.chevron_right_rounded,
                        color: sheetContext.colors.iconMuted,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
  if (choice == null || !context.mounted) return;
  switch (choice) {
    case _AddChoice.product:
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ProductFormScreen.add(companyId: companyId),
        ),
      );
    case _AddChoice.offer:
      await showAddOfferFlow(context, ref, companyId);
    case _AddChoice.service:
      showCreateOwnService(context, ref, companyId);
    case _AddChoice.technician:
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => TechnicianFormScreen.add(companyId: companyId),
        ),
      );
  }
}
