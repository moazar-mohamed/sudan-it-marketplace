import type { TranslationKey } from '../i18n/dictionary';
import type { IconName } from './Icon';

/*
 * The menu of the redesign (v2): eight sections instead of nineteen links. A section
 * with children opens them under it while it is the one you are in; every address
 * of the current panel still works and belongs to exactly one section.
 */

export interface NavV2Child {
  to: string;
  key: TranslationKey;
}

export interface NavV2Section {
  id: string;
  to: string;
  key: TranslationKey;
  icon: IconName;
  /** Opening addresses (and what sits under them) that belong to the section. */
  match: string[];
  children?: NavV2Child[];
}

export const NAV_V2_MAIN: NavV2Section[] = [
  { id: 'home', to: '/', key: 'nav.dashboard', icon: 'dashboard', match: ['/'] },
  {
    id: 'orders',
    to: '/orders',
    key: 'nav.orders',
    icon: 'orders',
    match: ['/orders', '/service-requests'],
    children: [
      { to: '/orders', key: 'nav.productOrders' },
      { to: '/service-requests', key: 'nav.serviceRequests' },
    ],
  },
  { id: 'companies', to: '/companies', key: 'nav.companies', icon: 'companies', match: ['/companies'] },
  {
    id: 'catalog',
    to: '/products',
    key: 'nav.group.catalog',
    icon: 'products',
    match: ['/products', '/services', '/categories', '/offers'],
    children: [
      { to: '/products', key: 'nav.products' },
      { to: '/services', key: 'nav.services' },
      { to: '/categories', key: 'nav.categories' },
      { to: '/offers', key: 'nav.offers' },
    ],
  },
  { id: 'customers', to: '/customers', key: 'nav.customers', icon: 'customers', match: ['/customers'] },
  { id: 'reviews', to: '/reviews', key: 'nav.reviews', icon: 'reviews', match: ['/reviews'] },
  { id: 'reports', to: '/reports', key: 'nav.reports', icon: 'flag', match: ['/reports'] },
  { id: 'analytics', to: '/analytics', key: 'nav.analytics', icon: 'analytics', match: ['/analytics'] },
];

export const NAV_V2_SYSTEM: NavV2Section[] = [
  {
    id: 'settings',
    to: '/settings',
    key: 'nav.settings',
    icon: 'settings',
    match: ['/settings', '/cities', '/terms', '/admins', '/activity', '/trash', '/profile'],
    children: [
      { to: '/settings', key: 'nav.noticesSettings' },
      { to: '/cities', key: 'nav.cities' },
      { to: '/terms', key: 'nav.terms' },
      { to: '/admins', key: 'nav.admins' },
      { to: '/activity', key: 'nav.activity' },
      { to: '/trash', key: 'nav.trash' },
    ],
  },
];

export const NAV_V2 = [...NAV_V2_MAIN, ...NAV_V2_SYSTEM];

/** Whether an address is the one given, or something under it. */
export const underPath = (pathname: string, prefix: string): boolean =>
  prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`);

/** The section the address belongs to, or undefined (e.g. the design-system page). */
export function sectionOfPath(pathname: string): NavV2Section | undefined {
  return NAV_V2.find((s) => s.match.some((m) => underPath(pathname, m)));
}

/** Every address that holds a number in the menu for the section (itself and its children). */
export const sectionPaths = (s: NavV2Section): string[] => [...new Set([s.to, ...(s.children ?? []).map((c) => c.to)])];

/** What the phone keeps in its bottom bar; everything else is under "More". */
export const TABBAR_V2_IDS = ['home', 'orders', 'companies', 'reports'];
