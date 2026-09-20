import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../orders/presentation/customer_orders_screen.dart';
import 'customer_notifications_screen.dart';
import 'customer_profile_screen.dart';
import 'widgets/dashboard_home_tab.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../settings/presentation/settings_screen.dart';

class CustomerDashboardScreen extends ConsumerStatefulWidget {
  const CustomerDashboardScreen({
    super.key,
    this.initialTabIndex = 0,
  });

  final int initialTabIndex;

  @override
  ConsumerState<CustomerDashboardScreen> createState() =>
      _CustomerDashboardScreenState();
}

class _CustomerDashboardScreenState
    extends ConsumerState<CustomerDashboardScreen> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialTabIndex;
  }

  void _onSelectTab(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    final tabs = [
      const DashboardHomeTab(),
      const CustomerOrdersScreen(showAppBar: false),
      const CustomerProfileScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(switch (_currentIndex) {
          1 => context.l10n.navMyOrders,
          2 => context.l10n.navProfile,
          _ => context.l10n.appName,
        }),
        actions: [
          const SettingsButton(),
          IconButton(
            tooltip: context.l10n.commonNotifications,
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const CustomerNotificationsScreen(),
                ),
              );
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: tabs,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _onSelectTab,
        backgroundColor: colorScheme.surface,
        indicatorColor: colorScheme.primary.withValues(alpha: 0.12),
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: context.l10n.navHome,
          ),
          NavigationDestination(
            icon: Icon(Icons.shopping_bag_outlined),
            selectedIcon: Icon(Icons.shopping_bag),
            label: context.l10n.navOrders,
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
