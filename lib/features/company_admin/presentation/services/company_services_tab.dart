import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../../core/widgets/app_widgets.dart';
import '../../../service_requests/presentation/service_requests_list.dart';
import 'my_services_view.dart';

/// The company's Services area: incoming service requests and the catalogue
/// services the company offers.
class CompanyServicesTab extends StatelessWidget {
  const CompanyServicesTab({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context) {
    return AppTabbedView(
      labels: [
        context.l10n.adminServiceRequestsTab,
        context.l10n.adminMyServicesTab,
      ],
      children: [
        ServiceRequestsList(asCompany: true, companyId: companyId),
        MyServicesView(companyId: companyId),
      ],
    );
  }
}
