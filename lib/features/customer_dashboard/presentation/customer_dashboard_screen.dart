import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/l10n_extension.dart';
import '../../../core/localization/locale_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../auth/presentation/auth_state.dart';
import '../../auth/presentation/require_account.dart';
import '../../chats/domain/entities/chat_conversation.dart';
import '../../chats/presentation/chat_providers.dart';
import '../../chats/presentation/chats_list_screen.dart';
import '../../cities/presentation/city_button.dart';
import '../../cities/presentation/city_providers.dart';
import '../../favorites/presentation/favorites_screen.dart';
import '../../notifications/presentation/notifications_providers.dart';
import '../../search/presentation/customer_search_screen.dart';
import '../../settings/presentation/language_selector.dart';
import 'customer_notifications_screen.dart';
import 'customer_profile_screen.dart';
import 'site/site_browse.dart';
import 'site/site_compare.dart';
import 'site/site_detail_parts.dart';
import 'site/site_orders.dart';
import 'site/site_companies.dart';
import 'site/site_home.dart';

/// The pages of the customer app, in the order of the site's top bar
/// (sictm.net): the last two need an account.
enum CustomerSection { home, products, services, companies, orders, chats }

/// The customer app, laid out as sictm.net on a phone: a navy bar with the
/// logo, the search, favourites, notifications, language and account buttons,
/// and under it a strip of the site's pages. A visitor without an account
/// browses the same pages; the account pages wait for sign-in.
class CustomerDashboardScreen extends ConsumerStatefulWidget {
  const CustomerDashboardScreen({
    super.key,
    this.initialSection = CustomerSection.home,
  });

  final CustomerSection initialSection;

  @override
  ConsumerState<CustomerDashboardScreen> createState() =>
      _CustomerDashboardScreenState();
}

class _CustomerDashboardScreenState
    extends ConsumerState<CustomerDashboardScreen> {
  late CustomerSection _section = widget.initialSection;

  /// The category the products page shows; the home's category cards set it.
  final _productsCategory = ValueNotifier<String?>(null);

  /// The category the services page shows; a service page's path sets it.
  final _servicesCategory = ValueNotifier<String?>(null);

  @override
  void dispose() {
    _productsCategory.dispose();
    _servicesCategory.dispose();
    super.dispose();
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

  void _open(CustomerSection section) {
    if (_section != section) setState(() => _section = section);
  }

  void _openCategory(String id) {
    _productsCategory.value = id;
    _open(CustomerSection.products);
  }

  void _push(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final uid = switch (ref.watch(authControllerProvider)) {
      AuthAuthenticated(:final user) => user.id,
      _ => null,
    };
    final signedIn = uid != null && uid.isNotEmpty;
    // Keeps the list of cities (Platform Admin edits it) live while shopping.
    ref.watch(citiesProvider);
    // The profile loads after the first frame: ask as soon as it says "no city".
    ref.listen(customerNeedsCityProvider, (_, needs) {
      if (needs) _askForCityIfMissing();
    });
    // A path on a product or service page asks for the shop on a category.
    ref.listen<SiteShopRequest?>(siteShopRequestProvider, (_, request) {
      if (request == null) return;
      if (request.services) {
        _servicesCategory.value = request.categoryId;
        _open(CustomerSection.services);
      } else {
        _productsCategory.value = request.categoryId;
        _open(CustomerSection.products);
      }
    });

    final sections = [
      CustomerSection.home,
      CustomerSection.products,
      CustomerSection.services,
      CustomerSection.companies,
      if (signedIn) ...[CustomerSection.orders, CustomerSection.chats],
    ];
    // Signed out on an account page (a sign-out from it): back to the home.
    final section = sections.contains(_section)
        ? _section
        : CustomerSection.home;

    return Scaffold(
      appBar: SiteBar(
        signedIn: signedIn,
        uid: uid,
        sections: sections,
        current: section,
        onSection: _open,
        onSearch: () => _push(const CustomerSearchScreen()),
        onFavorites: () => _push(const FavoritesScreen()),
        onNotifications: () => _push(const CustomerNotificationsScreen()),
        onAccount: () => _push(const _AccountPage()),
        onSignIn: () => openSignIn(context),
      ),
      body: IndexedStack(
        index: sections.indexOf(section),
        children: [
          for (final s in sections)
            _SectionBody(
              section: s,
              onOpen: _open,
              onCategory: _openCategory,
              productsCategory: _productsCategory,
              servicesCategory: _servicesCategory,
            ),
        ],
      ),
      // The products picked for comparison (not over the chats).
      bottomNavigationBar: section == CustomerSection.chats
          ? null
          : const SiteCompareBar(),
    );
  }
}

class _SectionBody extends StatelessWidget {
  const _SectionBody({
    required this.section,
    required this.onOpen,
    required this.onCategory,
    required this.productsCategory,
    required this.servicesCategory,
  });

  final CustomerSection section;
  final ValueChanged<CustomerSection> onOpen;
  final ValueChanged<String> onCategory;
  final ValueNotifier<String?> productsCategory;
  final ValueNotifier<String?> servicesCategory;

  @override
  Widget build(BuildContext context) {
    return switch (section) {
      CustomerSection.home => SiteHomePage(
        links: SiteHomeLinks(
          products: () => onOpen(CustomerSection.products),
          services: () => onOpen(CustomerSection.services),
          companies: () => onOpen(CustomerSection.companies),
          orders: () => onOpen(CustomerSection.orders),
          category: onCategory,
        ),
      ),
      CustomerSection.products => SiteBrowsePage(
        kind: SiteBrowseKind.products,
        category: productsCategory,
      ),
      CustomerSection.services => SiteBrowsePage(
        kind: SiteBrowseKind.services,
        category: servicesCategory,
      ),
      CustomerSection.companies => const SiteCompaniesPage(),
      CustomerSection.orders => SiteOrdersPage(
        onBrowse: () => onOpen(CustomerSection.products),
      ),
      CustomerSection.chats => const ChatsListScreen(
        role: ChatParticipantRole.customer,
      ),
    };
  }
}

/// «حسابي»: the profile page on its own screen, as /profile on the site.
/// Signing out from it goes back to the shop, as a visitor (the site's home).
class _AccountPage extends ConsumerWidget {
  const _AccountPage();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authControllerProvider, (_, next) {
      if (next is! AuthAuthenticated && context.mounted) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    });
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.navMyAccount)),
      body: const CustomerProfileScreen(),
    );
  }
}

/// The site's navy top bar (`.nav` in customer_web/src/styles.css): the logo
/// and name, then the round-cornered buttons, and under them the strip of
/// pages (`.nav-strip`).
class SiteBar extends ConsumerWidget implements PreferredSizeWidget {
  const SiteBar({
    super.key,
    required this.signedIn,
    required this.uid,
    required this.sections,
    required this.current,
    required this.onSection,
    required this.onSearch,
    required this.onFavorites,
    required this.onNotifications,
    required this.onAccount,
    required this.onSignIn,
  });

  final bool signedIn;
  final String? uid;
  final List<CustomerSection> sections;
  final CustomerSection current;
  final ValueChanged<CustomerSection> onSection;
  final VoidCallback onSearch;
  final VoidCallback onFavorites;
  final VoidCallback onNotifications;
  final VoidCallback onAccount;
  final VoidCallback onSignIn;

  static const double _barHeight = 64;
  static const double _stripHeight = 50;

  @override
  Size get preferredSize => const Size.fromHeight(_barHeight + _stripHeight);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final colors = context.colors;
    final unreadChats = signedIn
        ? ref.watch(customerUnreadChatsCountProvider)
        : 0;
    final unreadNotes = signedIn
        ? (ref.watch(customerNotificationsStreamProvider(uid!)).asData?.value ??
                  const [])
              .where((n) => !n.isRead)
              .length
        : 0;
    final english = ref.watch(localeControllerProvider).languageCode == 'en';

    String label(CustomerSection s) => switch (s) {
      CustomerSection.home => l10n.navHome,
      CustomerSection.products => l10n.navProducts,
      CustomerSection.services => l10n.navServices,
      CustomerSection.companies => l10n.navCompanies,
      CustomerSection.orders => l10n.navMyOrders,
      CustomerSection.chats => l10n.navChats,
    };

    return AppBar(
      toolbarHeight: _barHeight,
      automaticallyImplyLeading: false,
      backgroundColor: colors.navBar,
      titleSpacing: 16,
      title: GestureDetector(
        onTap: () => onSection(CustomerSection.home),
        child: Row(
          children: [
            const _BrandLogo(),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                'Sudan ICT Marketplace',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textDirection: TextDirection.ltr,
                style: AppTextStyles.bodyStrong.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
      actions: [
        _BarButton(
          tooltip: l10n.commonSearch,
          onPressed: onSearch,
          child: const Icon(Icons.search_rounded, size: 22),
        ),
        if (signedIn)
          _BarButton(
            tooltip: l10n.favoritesTitle,
            onPressed: onFavorites,
            child: const Icon(Icons.favorite_border_rounded, size: 22),
          ),
        if (signedIn)
          _BarButton(
            tooltip: l10n.commonNotifications,
            onPressed: onNotifications,
            child: Badge(
              isLabelVisible: unreadNotes > 0,
              backgroundColor: colors.error,
              label: Text(unreadNotes > 9 ? '9+' : '$unreadNotes'),
              child: const Icon(Icons.notifications_none_rounded, size: 22),
            ),
          ),
        _BarButton(
          tooltip: l10n.commonLanguage,
          onPressed: () =>
              changeAppLanguage(context, ref, Locale(english ? 'ar' : 'en')),
          child: Text(
            english ? 'عربي' : 'EN',
            style: AppTextStyles.captionStrong.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        _BarButton(
          tooltip: signedIn ? l10n.navMyAccount : l10n.authLogin,
          solid: true,
          onPressed: signedIn ? onAccount : onSignIn,
          child: const Icon(Icons.person_outline_rounded, size: 22),
        ),
        const SizedBox(width: 12),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(_stripHeight),
        child: SizedBox(
          height: _stripHeight,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            children: [
              for (final s in sections)
                _StripLink(
                  label: label(s),
                  active: s == current,
                  count: s == CustomerSection.chats ? unreadChats : 0,
                  onTap: () => onSection(s),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The white square with the emblem, as `.brand-logo` on the site.
class _BrandLogo extends StatelessWidget {
  const _BrandLogo();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.asset('assets/images/app_mark.png', fit: BoxFit.contain),
      ),
    );
  }
}

/// A button of the bar: a 10 px rounded square, faint white, or green when
/// [solid] (the account / sign-in button, `.icon-btn.solid`).
class _BarButton extends StatelessWidget {
  const _BarButton({
    required this.tooltip,
    required this.onPressed,
    required this.child,
    this.solid = false,
  });

  final String tooltip;
  final VoidCallback onPressed;
  final Widget child;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 6),
      child: Tooltip(
        message: tooltip,
        child: Semantics(
          button: true,
          label: tooltip,
          excludeSemantics: true,
          child: Material(
            color: solid ? colors.action : Colors.white.withValues(alpha: 0.1),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: solid
                  ? BorderSide.none
                  : BorderSide(color: Colors.white.withValues(alpha: 0.22)),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onPressed,
              child: SizedBox(
                width: 40,
                height: 40,
                child: IconTheme.merge(
                  data: const IconThemeData(color: Colors.white),
                  child: Center(child: child),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One page in the strip under the bar (`.nav .nav-strip a`).
class _StripLink extends StatelessWidget {
  const _StripLink({
    required this.label,
    required this.active,
    required this.count,
    required this.onTap,
  });

  final String label;
  final bool active;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 4),
      child: Semantics(
        selected: active,
        button: true,
        child: Material(
          color: active
              ? Colors.white.withValues(alpha: 0.17)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: AppTextStyles.bodyStrong.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: active
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                  if (count > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      constraints: const BoxConstraints(minWidth: 18),
                      padding: const EdgeInsets.symmetric(horizontal: 5),
                      decoration: BoxDecoration(
                        color: colors.action,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        count > 9 ? '9+' : '$count',
                        textAlign: TextAlign.center,
                        style: AppTextStyles.captionStrong.copyWith(
                          color: Colors.white,
                          fontSize: 11,
                          height: 18 / 11,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
