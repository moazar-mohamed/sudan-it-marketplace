import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dashboard/company_dashboard_tab.dart';
import 'installation/installation_jobs_tab.dart';
import 'notifications/company_notifications_screen.dart';
import 'orders/company_orders_tab.dart';
import 'products/company_products_tab.dart';
import 'profile/company_profile_tab.dart';
import 'services/company_services_tab.dart';
import 'technicians/technicians_tab.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../chats/domain/entities/chat_conversation.dart';
import '../../chats/presentation/chat_providers.dart';
import '../../chats/presentation/chats_list_screen.dart';
import '../../service_requests/presentation/service_request_providers.dart';
import '../../settings/presentation/settings_screen.dart';

/// Entry point of the Company Admin experience for a signed-in company admin.
class CompanyAdminShell extends ConsumerStatefulWidget {
  const CompanyAdminShell({super.key, required this.companyId});

  final String companyId;

  @override
  ConsumerState<CompanyAdminShell> createState() => _CompanyAdminShellState();
}

/// Section indexes of the shell's [IndexedStack]. The dashboard's shortcuts
/// use the same numbers.
abstract final class _Section {
  static const dashboard = 0;
  static const products = 1;
  static const orders = 2;
  static const installations = 3;
  static const services = 4;
  static const technicians = 5;
  static const profile = 6;
}

class _CompanyAdminShellState extends ConsumerState<CompanyAdminShell> {
  int _currentIndex = _Section.dashboard;

  void _selectTab(int index) => setState(() => _currentIndex = index);

  /// Bottom-bar slots: the four main sections, then "More" (installations,
  /// technicians, profile), so the bar keeps five destinations and never
  /// wraps on a phone.
  static const _barSections = [
    _Section.dashboard,
    _Section.products,
    _Section.orders,
    _Section.services,
  ];

  int get _barIndex {
    final slot = _barSections.indexOf(_currentIndex);
    return slot >= 0 ? slot : _barSections.length;
  }

  void _onBarSelected(int slot) {
    if (slot < _barSections.length) {
      _selectTab(_barSections[slot]);
    } else {
      _openMore();
    }
  }

  Future<void> _openMore() async {
    final l10n = context.l10n;
    final entries = [
      (
        _Section.installations,
        Icons.handyman_outlined,
        l10n.adminNavInstallations,
      ),
      (
        _Section.technicians,
        Icons.engineering_outlined,
        l10n.navTechnicians,
      ),
      (_Section.profile, Icons.business_outlined, l10n.adminCompanyProfile),
    ];
    final selected = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        final colorScheme = Theme.of(sheetContext).colorScheme;
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final (section, icon, label) in entries)
                ListTile(
                  leading: Icon(icon),
                  title: Text(label),
                  selected: section == _currentIndex,
                  selectedColor: colorScheme.primary,
                  onTap: () => Navigator.of(sheetContext).pop(section),
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
    if (selected != null && mounted) _selectTab(selected);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final companyId = widget.companyId;
    final unreadChats = ref.watch(companyUnreadChatsCountProvider(companyId));
    final pendingRequests =
        ref.watch(companyPendingServiceRequestsCountProvider(companyId));

    final tabs = [
      CompanyDashboardTab(companyId: companyId, onSelectTab: _selectTab),
      CompanyProductsTab(companyId: companyId),
      CompanyOrdersTab(companyId: companyId),
      InstallationJobsTab(companyId: companyId),
      CompanyServicesTab(companyId: companyId),
      TechniciansTab(companyId: companyId),
      CompanyProfileTab(companyId: companyId),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          switch (_currentIndex) {
            _Section.products => context.l10n.navProducts,
            _Section.orders => context.l10n.navOrders,
            _Section.installations => context.l10n.adminInstallationJobs,
            _Section.services => context.l10n.navServices,
            _Section.technicians => context.l10n.navTechnicians,
            _Section.profile => context.l10n.adminCompanyProfile,
            _ => context.l10n.adminCompanyDashboard,
          },
        ),
        actions: [
          const SettingsButton(),
          IconButton(
            tooltip: context.l10n.navChats,
            icon: Badge.count(
              count: unreadChats,
              isLabelVisible: unreadChats > 0,
              child: const Icon(Icons.chat_bubble_outline),
            ),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ChatsListScreen(
                    role: ChatParticipantRole.company,
                    companyId: companyId,
                    showAppBar: true,
                  ),
                ),
              );
            },
          ),
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
        selectedIndex: _barIndex,
        onDestinationSelected: _onBarSelected,
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
            icon: Badge.count(
              count: pendingRequests,
              isLabelVisible: pendingRequests > 0,
              child: const Icon(Icons.miscellaneous_services_outlined),
            ),
            selectedIcon: Badge.count(
              count: pendingRequests,
              isLabelVisible: pendingRequests > 0,
              child: const Icon(Icons.miscellaneous_services),
            ),
            label: context.l10n.navServices,
          ),
          NavigationDestination(
            icon: const Icon(Icons.menu_rounded),
            selectedIcon: const Icon(Icons.menu_open_rounded),
            label: context.l10n.navMore,
          ),
        ],
      ),
    );
  }
}
