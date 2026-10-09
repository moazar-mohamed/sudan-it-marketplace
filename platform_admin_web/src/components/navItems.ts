import type { TranslationKey } from '../i18n/dictionary';
import type { IconName } from './Icon';

export interface NavItem {
  to: string;
  key: TranslationKey;
  icon: IconName;
  end?: boolean;
}

/** The menu, grouped by what an admin is doing: running the day, the catalogue, the people, the platform itself. */
export const NAV_GROUPS: { key: TranslationKey; items: NavItem[] }[] = [
  {
    key: 'nav.group.operations',
    items: [
      { to: '/', key: 'nav.dashboard', icon: 'dashboard', end: true },
      { to: '/orders', key: 'nav.orders', icon: 'orders' },
      { to: '/service-requests', key: 'nav.serviceRequests', icon: 'serviceRequests' },
      { to: '/reports', key: 'nav.reports', icon: 'flag' },
    ],
  },
  {
    key: 'nav.group.catalog',
    items: [
      { to: '/companies', key: 'nav.companies', icon: 'companies' },
      { to: '/products', key: 'nav.products', icon: 'products' },
      { to: '/services', key: 'nav.services', icon: 'services' },
      { to: '/categories', key: 'nav.categories', icon: 'categories' },
      { to: '/offers', key: 'nav.offers', icon: 'offers' },
    ],
  },
  {
    key: 'nav.group.community',
    items: [
      { to: '/customers', key: 'nav.customers', icon: 'customers' },
      { to: '/reviews', key: 'nav.reviews', icon: 'reviews' },
    ],
  },
  {
    key: 'nav.group.system',
    items: [
      { to: '/cities', key: 'nav.cities', icon: 'globe' },
      { to: '/analytics', key: 'nav.analytics', icon: 'analytics' },
      { to: '/activity', key: 'nav.activity', icon: 'activity' },
      { to: '/admins', key: 'nav.admins', icon: 'shield' },
      { to: '/trash', key: 'nav.trash', icon: 'trash' },
      { to: '/profile', key: 'nav.profile', icon: 'profile' },
      { to: '/settings', key: 'nav.settings', icon: 'settings' },
    ],
  },
];

export const NAV = NAV_GROUPS.flatMap((g) => g.items);
