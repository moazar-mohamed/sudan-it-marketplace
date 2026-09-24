import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dashboard/technician_dashboard_tab.dart';
import 'jobs/technician_jobs_tab.dart';
import 'notifications/technician_notifications_screen.dart';
import 'profile/technician_profile_screen.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../settings/presentation/settings_screen.dart';

/// Entry point of the Technician experience for a signed-in technician.
/// Fully separate from CompanyAdminShell: technicians never see Company
/// Admin dashboard, products, orders management, company profile, or
/// company-admin controls.
class TechnicianShell extends ConsumerStatefulWidget {
  const TechnicianShell({
    super.key,
    required this.companyId,
    required this.technicianId,
    required this.technicianName,
    required this.technicianPhone,
  });

  final String companyId;
  final String technicianId;
  final String technicianName;
  final String technicianPhone;

  @override
  ConsumerState<TechnicianShell> createState() => _TechnicianShellState();
}

class _TechnicianShellState extends ConsumerState<TechnicianShell> {
  int _currentIndex = 0;

  void _selectTab(int index) => setState(() => _currentIndex = index);

  @override
  Widget build(BuildContext context) {
    final tabs = [
      TechnicianDashboardTab(
        technicianId: widget.technicianId,
        technicianName: widget.technicianName,
        onSelectJobsTab: () => _selectTab(1),
      ),
      TechnicianJobsTab(technicianId: widget.technicianId),
      TechnicianProfileScreen(
        companyId: widget.companyId,
        technicianPhone: widget.technicianPhone,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          switch (_currentIndex) {
            1 => context.l10n.techShellJobs,
            2 => context.l10n.navProfile,
            _ => context.l10n.techShellDashboard,
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
                  builder: (_) => TechnicianNotificationsScreen(
                    technicianId: widget.technicianId,
                  ),
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
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: context.l10n.navDashboard,
          ),
          NavigationDestination(
            icon: Icon(Icons.handyman_outlined),
            selectedIcon: Icon(Icons.handyman),
            label: context.l10n.techNavJobs,
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: context.l10n.navProfile,
          ),
        ],
      ),
    );
  }
}
