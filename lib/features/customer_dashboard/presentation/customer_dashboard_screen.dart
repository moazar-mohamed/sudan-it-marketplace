import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../chats/domain/entities/chat_conversation.dart';
import '../../cities/presentation/city_button.dart';
import '../../cities/presentation/city_providers.dart';
import '../../chats/presentation/chat_providers.dart';
import '../../chats/presentation/chats_list_screen.dart';
import 'customer_notifications_screen.dart';
import 'customer_profile_screen.dart';
import 'widgets/customer_orders_tab.dart';
import 'widgets/dashboard_home_tab.dart';
import '../../../core/localization/l10n_extension.dart';
import '../../../core/widgets/app_surfaces.dart';
import '../../settings/presentation/settings_screen.dart';

class CustomerDashboardScreen extends ConsumerStatefulWidget {
  const CustomerDashboardScreen({super.key, this.initialTabIndex = 0});

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

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // A customer with no city yet picks one before using the marketplace.
    WidgetsBinding.instance.addPostFrameCallback((_) => _askForCityIfMissing());
  }

  bool _askingForCity = false;

  Future<void> _askForCityIfMissing() async {
    if (!mounted || _askingForCity || !ref.read(customerNeedsCityProvider)) {
      return;
    }
    _askingForCity = true;
    await chooseCustomerCity(context, ref, required: true);
    _askingForCity = false;
  }

  void _onSelectTab(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final unreadChats = ref.watch(customerUnreadChatsCountProvider);
    // Keeps the list of cities (Platform Admin edits it) live while shopping.
    ref.watch(citiesProvider);
    // The profile loads after the first frame: ask as soon as it says "no city".
    ref.listen(customerNeedsCityProvider, (_, needs) {
      if (needs) _askForCityIfMissing();
    });

    final tabs = [
      const DashboardHomeTab(),
      const CustomerOrdersTab(),
      const ChatsListScreen(role: ChatParticipantRole.customer),
      const CustomerProfileScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: switch (_currentIndex) {
          1 => Text(context.l10n.navMyOrders),
          2 => Text(context.l10n.navChats),
          3 => Text(context.l10n.navProfile),
          _ => Row(
            children: [
              const AppLogoMark(),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  context.l10n.appName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        },
        actions: [
          if (_currentIndex == 0) const CityButton(),
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
      body: IndexedStack(index: _currentIndex, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _onSelectTab,
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
            icon: Badge.count(
              count: unreadChats,
              isLabelVisible: unreadChats > 0,
              child: const Icon(Icons.chat_bubble_outline),
            ),
            selectedIcon: Badge.count(
              count: unreadChats,
              isLabelVisible: unreadChats > 0,
              child: const Icon(Icons.chat_bubble),
            ),
            label: context.l10n.navChats,
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
