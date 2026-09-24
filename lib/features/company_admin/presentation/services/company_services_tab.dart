import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../service_requests/presentation/service_requests_list.dart';
import 'my_services_view.dart';

/// The company's Services area: incoming service requests and the catalogue
/// services the company offers.
class CompanyServicesTab extends StatelessWidget {
  const CompanyServicesTab({super.key, required this.companyId});

  final String companyId;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Material(
            color: Theme.of(context).colorScheme.surface,
            child: TabBar(
              dividerColor: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.08),
              tabs: [
                Tab(text: context.l10n.adminServiceRequestsTab),
                Tab(text: context.l10n.adminMyServicesTab),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                ServiceRequestsList(asCompany: true, companyId: companyId),
                MyServicesView(companyId: companyId),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
