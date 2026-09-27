import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../chats/domain/entities/chat_conversation.dart';
import '../../chats/presentation/chat_providers.dart';
import '../../chats/presentation/chats_list_screen.dart';
import '../../companies/presentation/companies_providers.dart';
import '../../service_requests/presentation/service_request_providers.dart';
import '../../settings/presentation/settings_screen.dart';
import 'account/company_account_tab.dart';
import 'catalog/company_catalog_tab.dart';
import 'dashboard/company_dashboard_tab.dart';
import 'notifications/company_notifications_screen.dart';
import 'orders/company_orders_tab.dart';
import 'widgets/company_add_sheet.dart';

/// Entry point of the Company Admin experience for a signed-in company admin.
class CompanyAdminShell extends ConsumerStatefulWidget {
  const CompanyAdminShell({super.key, required this.companyId});

  final String companyId;

  @override
  ConsumerState<CompanyAdminShell> createState() => _CompanyAdminShellState();
}

/// Tabs of the shell, in bottom-bar order. The bar's last slot is the Add
/// button, which opens a sheet instead of a tab.
enum _Tab { home, orders, catalog, account }

class _CompanyAdminShellState extends ConsumerState<CompanyAdminShell> {
  _Tab _tab = _Tab.home;
  CompanyOrdersSection _ordersSection = CompanyOrdersSection.all;

  void _openOrders([CompanyOrdersSection section = CompanyOrdersSection.all]) {
    setState(() {
      _ordersSection = section;
      _tab = _Tab.orders;
    });
  }

  void _onBarSelected(int slot) {
    if (slot < _Tab.values.length) {
      setState(() => _tab = _Tab.values[slot]);
    } else {
      showCompanyAddSheet(context, ref, widget.companyId);
    }
  }

  void _push(Widget screen) => Navigator.of(context)
      .push(MaterialPageRoute<void>(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final companyId = widget.companyId;
    final unreadChats = ref.watch(companyUnreadChatsCountProvider(companyId));
    final pendingRequests =
        ref.watch(companyPendingServiceRequestsCountProvider(companyId));
    final companyName =
        ref.watch(companyStreamProvider(companyId)).asData?.value?.name ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Text(
          switch (_tab) {
            _Tab.home => companyName.isNotEmpty
                ? companyName
                : l10n.adminCompanyDashboard,
            _Tab.orders => l10n.navOrders,
            _Tab.catalog => l10n.navCatalog,
            _Tab.account => l10n.navAccount,
          },
        ),
        actions: [
          IconButton(
            tooltip: l10n.navChats,
            icon: Badge.count(
              count: unreadChats,
              isLabelVisible: unreadChats > 0,
              child: const Icon(Icons.chat_bubble_outline),
            ),
            onPressed: () => _push(
              ChatsListScreen(
                role: ChatParticipantRole.company,
                companyId: companyId,
                showAppBar: true,
              ),
            ),
          ),
          IconButton(
            tooltip: l10n.commonNotifications,
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () =>
                _push(CompanyNotificationsScreen(companyId: companyId)),
          ),
          const SettingsButton(),
        ],
      ),
      body: IndexedStack(
        index: _tab.index,
        children: [
          CompanyDashboardTab(
            companyId: companyId,
            onOpenOrders: _openOrders,
            onOpenCatalog: () => setState(() => _tab = _Tab.catalog),
          ),
          CompanyOrdersTab(
            companyId: companyId,
            section: _ordersSection,
            onSectionChanged: (section) =>
                setState(() => _ordersSection = section),
          ),
          CompanyCatalogTab(companyId: companyId),
          CompanyAccountTab(companyId: companyId),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab.index,
        onDestinationSelected: _onBarSelected,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home_rounded),
            label: l10n.navHome,
          ),
          NavigationDestination(
            icon: Badge.count(
              count: pendingRequests,
              isLabelVisible: pendingRequests > 0,
              child: const Icon(Icons.receipt_long_outlined),
            ),
            selectedIcon: Badge.count(
              count: pendingRequests,
              isLabelVisible: pendingRequests > 0,
              child: const Icon(Icons.receipt_long),
            ),
            label: l10n.navOrders,
          ),
          NavigationDestination(
            icon: const Icon(Icons.inventory_2_outlined),
            selectedIcon: const Icon(Icons.inventory_2),
            label: l10n.navCatalog,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline_rounded),
            selectedIcon: const Icon(Icons.person_rounded),
            label: l10n.navAccount,
          ),
          NavigationDestination(
            icon: const _AddIcon(),
            label: l10n.adminAddNew,
            tooltip: l10n.adminAddNewTitle,
          ),
        ],
      ),
    );
  }
}

/// The Add slot's filled brand circle, so it reads as an action, not a tab.
class _AddIcon extends StatelessWidget {
  const _AddIcon();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(color: scheme.primary, shape: BoxShape.circle),
      child: Icon(Icons.add_rounded, color: scheme.onPrimary, size: 22),
    );
  }
}
