import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dashboard/company_dashboard_tab.dart';
import 'installation/installation_jobs_tab.dart';
import 'notifications/company_notifications_screen.dart';
import 'orders/company_orders_tab.dart';
import 'products/company_products_tab.dart';
import 'profile/company_profile_tab.dart';
import 'technicians/technicians_tab.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../settings/presentation/settings_screen.dart';

/// Entry point of the Company Admin experience for a signed-in company admin.
class CompanyAdminShell extends ConsumerStatefulWidget {
  const CompanyAdminShell({super.key, required this.companyId});

  final String companyId;

  @override
  ConsumerState<CompanyAdminShell> createState() => _CompanyAdminShellState();
}

class _CompanyAdminShellState extends ConsumerState<CompanyAdminShell> {
  int _currentIndex = 0;

  void _selectTab(int index) => setState(() => _currentIndex = index);

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final companyId = widget.companyId;

    final tabs = [
      CompanyDashboardTab(companyId: companyId, onSelectTab: _selectTab),
      CompanyProductsTab(companyId: companyId),
      CompanyOrdersTab(companyId: companyId),
      InstallationJobsTab(companyId: companyId),
      TechniciansTab(companyId: companyId),
      CompanyProfileTab(companyId: companyId),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          switch (_currentIndex) {
            1 => context.l10n.navProducts,
            2 => context.l10n.navOrders,
            3 => context.l10n.adminInstallationJobs,
            4 => context.l10n.navTechnicians,
            5 => context.l10n.adminCompanyProfile,
            _ => context.l10n.adminCompanyDashboard,
          },
        ),
        actions: [
          const SettingsButton(),
          IconButton(
            tooltip: context.l10n.commonNotifications,
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) =>
                      CompanyNotificationsScreen(companyId: companyId),
                ),
              );
            },
          ),
        ],
      ),
      body: IndexedStack(index: _currentIndex, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _selectTab,
        backgroundColor: colorScheme.surface,
        indicatorColor: colorScheme.primary.withValues(alpha: 0.12),
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: context.l10n.navDashboard,
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: context.l10n.navProducts,
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: context.l10n.navOrders,
          ),
          NavigationDestination(
            icon: Icon(Icons.handyman_outlined),
            selectedIcon: Icon(Icons.handyman),
            label: context.l10n.adminNavInstallations,
          ),
          NavigationDestination(
            icon: Icon(Icons.engineering_outlined),
            selectedIcon: Icon(Icons.engineering),
            label: context.l10n.navTechnicians,
          ),
          NavigationDestination(
            icon: Icon(Icons.business_outlined),
            selectedIcon: Icon(Icons.business),
            label: context.l10n.navProfile,
          ),
        ],
      ),
    );
  }
}
