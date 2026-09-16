import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dashboard/company_dashboard_tab.dart';
import 'installation/installation_jobs_tab.dart';
import 'notifications/company_notifications_screen.dart';
import 'orders/company_orders_tab.dart';
import 'products/company_products_tab.dart';
import 'profile/company_profile_tab.dart';
import 'technicians/technicians_tab.dart';

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
            1 => 'Products',
            2 => 'Orders',
            3 => 'Installation Jobs',
            4 => 'Technicians',
            5 => 'Company Profile',
            _ => 'Company Dashboard',
          },
        ),
        actions: [
          IconButton(
            tooltip: 'Notifications',
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
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: 'Products',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Orders',
          ),
          NavigationDestination(
            icon: Icon(Icons.handyman_outlined),
            selectedIcon: Icon(Icons.handyman),
            label: 'Installations',
          ),
          NavigationDestination(
            icon: Icon(Icons.engineering_outlined),
            selectedIcon: Icon(Icons.engineering),
            label: 'Technicians',
          ),
          NavigationDestination(
            icon: Icon(Icons.business_outlined),
            selectedIcon: Icon(Icons.business),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
