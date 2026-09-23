import 'package:flutter/material.dart';

import '../../../../core/localization/l10n_extension.dart';
import '../../../orders/presentation/customer_orders_screen.dart';
import '../../../service_requests/presentation/service_requests_list.dart';

/// The customer's Orders tab: product orders (unchanged) and service
/// requests, each in its own sub-tab. Service requests are loaded only when
/// their sub-tab is opened.
class CustomerOrdersTab extends StatelessWidget {
  const CustomerOrdersTab({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Material(
            color: Theme.of(context).colorScheme.surface,
            child: TabBar(
              tabs: [
                Tab(text: context.l10n.ordersTabProducts),
                Tab(text: context.l10n.ordersTabServices),
              ],
            ),
          ),
          const Expanded(
            child: TabBarView(
              children: [
                CustomerOrdersScreen(showAppBar: false),
                ServiceRequestsList(asCompany: false),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
