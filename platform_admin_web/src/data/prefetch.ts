import { stores } from './store';

type Loader = () => Promise<unknown>;

/*
 * Each page is its own file, fetched the first time it is opened (see App.tsx), and each
 * section reads its collections the first time it is shown. Both waits are what made moving
 * between sections feel slow, so they are done ahead of the click: every page file is fetched
 * once the panel is open and idle, and the collections of a section are started as soon as the
 * pointer (or the keyboard) reaches its link. Only the loading moves; nothing new is read.
 */

/** The page file of each first address segment ('' is the home page). */
export const PAGE_LOADERS: Record<string, Loader> = {
  '': () => import('../pages/DashboardPage'),
  companies: () => import('../pages/CompaniesPage'),
  customers: () => import('../pages/CustomersPage'),
  products: () => import('../pages/ProductsPage'),
  orders: () => import('../pages/OrdersPage'),
  categories: () => import('../pages/CategoriesPage'),
  services: () => import('../pages/ServicesPage'),
  'service-requests': () => import('../pages/ServiceRequestsPage'),
  offers: () => import('../pages/OffersPage'),
  reports: () => import('../pages/ReportsPage'),
  reviews: () => import('../pages/ReviewsPage'),
  cities: () => import('../pages/CitiesPage'),
  analytics: () => import('../pages/AnalyticsPage'),
  activity: () => import('../pages/ActivityPage'),
  admins: () => import('../pages/AdminsPage'),
  profile: () => import('../pages/ProfilePage'),
  trash: () => import('../pages/TrashPage'),
  settings: () => import('../pages/SettingsPage'),
};

type StoreName = keyof typeof stores;

/** The collections a section needs open. Orders are read a page at a time, so they are not here. */
export const SECTION_STORES: Record<string, StoreName[]> = {
  companies: ['companies', 'products'],
  customers: ['customers'],
  products: ['products'],
  categories: ['categories', 'products', 'services'],
  services: ['categories', 'services'],
  'service-requests': ['serviceRequests'],
  offers: ['companies', 'companyServices', 'products', 'services'],
  reports: ['reports'],
  reviews: ['reviews'],
  admins: ['admins'],
  activity: ['auditLog'],
};

const segmentOf = (pathname: string): string => pathname.split('?')[0].split('/').filter(Boolean)[0] ?? '';

const noop = () => undefined;

/** Starts a collection's shared listener (a no-op when it is already running). */
const warm = (name: StoreName) => stores[name].subscribe(noop)();

/** Gets ready for an address: its page file and its collections. Never throws. */
export function prefetchPath(pathname: string, loaders: Record<string, Loader> = PAGE_LOADERS, sections = SECTION_STORES): void {
  const segment = segmentOf(pathname);
  try {
    void loaders[segment]?.().catch(noop);
    for (const name of sections[segment] ?? []) warm(name);
  } catch {
    // Getting ready is only a head start; the page still loads itself when opened.
  }
}

/** Fetches every page file, one after the other, when the browser has nothing else to do. */
export function prefetchAllPages(loaders: Record<string, Loader> = PAGE_LOADERS): () => void {
  const pending = Object.values(loaders);
  let stopped = false;
  const idle: (cb: () => void) => void =
    typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (cb) => (window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(cb)
      : (cb) => void setTimeout(cb, 200);
  const next = () => {
    if (stopped) return;
    const load = pending.shift();
    if (!load) return;
    void load()
      .catch(noop)
      .then(() => idle(next));
  };
  idle(next);
  return () => {
    stopped = true;
  };
}
