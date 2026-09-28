import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../offers/company_offers_tab.dart';
import '../products/company_products_tab.dart';
import '../services/my_services_view.dart';

/// Everything the company offers, in one place: its products, its services
/// and the offers it runs on them. New items are added from the bottom bar's
/// Add button.
class CompanyCatalogTab extends StatelessWidget {
  const CompanyCatalogTab({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context) {
    return AppTabbedView(
      labels: [
        context.l10n.navProducts,
        context.l10n.navServices,
        context.l10n.catalogOffers,
      ],
      children: [
        CompanyProductsTab(companyId: companyId),
        MyServicesView(companyId: companyId),
        CompanyOffersTab(companyId: companyId),
      ],
    );
  }
}
