import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../products/company_products_tab.dart';
import '../services/my_services_view.dart';

/// Everything the company offers, in one place: its products and its
/// services. New items are added from the bottom bar's Add button.
class CompanyCatalogTab extends StatelessWidget {
  const CompanyCatalogTab({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context) {
    return AppTabbedView(
      labels: [context.l10n.navProducts, context.l10n.navServices],
      children: [
        CompanyProductsTab(companyId: companyId),
        MyServicesView(companyId: companyId),
      ],
    );
  }
}
