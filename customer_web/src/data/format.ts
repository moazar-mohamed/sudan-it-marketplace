import type { Category, Priced, Product, RatingStats } from './types';

const CURRENCY_LABEL: Record<string, string> = { SDG: 'ج.س' };

/** Digits as the app writes them: 279,000. */
export function formatPrice(amount: number, currency = 'SDG'): string {
  return `${amount.toLocaleString('en-US')} ${CURRENCY_LABEL[currency] ?? currency}`;
}

export function formatDate(value: Date): string {
  return value.toLocaleDateString('ar-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** `2026-11-02 14:05`, on the reader's clock. */
export function formatDateTime(value: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${two(value.getMonth() + 1)}-${two(value.getDate())} ${two(value.getHours())}:${two(value.getMinutes())}`;
}

/** "شركة واحدة", "شركتان", "3 شركات", "11 شركة". */
export function countText(count: number, one: string, two: string, few: string, many: string): string {
  if (count === 1) return one;
  if (count === 2) return two;
  return `${count} ${count >= 3 && count <= 10 ? few : many}`;
}

export const productsCount = (n: number): string => countText(n, 'منتج واحد', 'منتجان', 'منتجات', 'منتج');
export const servicesCount = (n: number): string => countText(n, 'خدمة واحدة', 'خدمتان', 'خدمات', 'خدمة');
export const companiesCount = (n: number): string => countText(n, 'شركة واحدة', 'شركتان', 'شركات', 'شركة');

// ── offers (lib/features/offers/domain/offer_pricing.dart) ─────────────────

/** An offer is set with a price below the normal one. */
function hasOffer(p: Priced): boolean {
  return p.offerPrice !== null && p.price !== null && p.offerPrice < p.price;
}

/** An offer is set and has not reached its end date. */
export function hasActiveOffer(p: Priced, now = new Date()): boolean {
  return hasOffer(p) && (p.offerEndsAt === null || now < p.offerEndsAt);
}

/** What a customer pays right now. */
export function salePrice(p: Priced, now = new Date()): number | null {
  return hasActiveOffer(p, now) ? p.offerPrice : p.price;
}

export function discountPercent(p: Priced): number {
  return hasOffer(p) ? Math.round((1 - p.offerPrice! / p.price!) * 100) : 0;
}

export function offerLabel(p: Priced): string {
  if (p.offerBadge === 'special') return 'عرض خاص';
  if (p.offerBadge === 'limited') return 'لفترة محدودة';
  return `خصم ${discountPercent(p)}%`;
}

// ── products ───────────────────────────────────────────────────────────────

export const isAvailable = (p: Product): boolean => p.inStock && p.stockCount > 0;

/** The most a customer may order right now. */
export const maxOrderQuantity = (p: Product): number => (isAvailable(p) ? p.stockCount : 0);

const NEW_PRODUCT_MS = 14 * 24 * 60 * 60 * 1000;

export function isNewProduct(p: Product, now = new Date()): boolean {
  return p.createdAt !== null && now.getTime() - p.createdAt.getTime() <= NEW_PRODUCT_MS;
}

// ── ratings ────────────────────────────────────────────────────────────────

export const ratingKey = (type: 'company' | 'product' | 'service', id: string): string =>
  `${type}_${id}`;

export const averageOf = (stats: RatingStats): number =>
  stats.count === 0 ? 0 : stats.sum / stats.count;

// ── categories ─────────────────────────────────────────────────────────────

export function categoryName(c: Category): string {
  return c.nameAr.trim() || c.name;
}

/** Every spelling of the name, so a search in either language finds it. */
export const categorySearchText = (c: Category): string => `${c.name} ${c.nameAr} ${c.nameEn}`;

/** Platform Admin's order first, then the rest by name. */
export function compareCategories(a: Category, b: Category): number {
  if (a.sortOrder !== null && b.sortOrder !== null && a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }
  if (a.sortOrder !== null && b.sortOrder === null) return -1;
  if (a.sortOrder === null && b.sortOrder !== null) return 1;
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

// Icon paths (24x24 stroke icons) for the icon keys Platform Admin can pick.
const P = {
  monitor: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  phone: 'M7 2h10v20H7z M11 18h2',
  wifi: 'M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  printer: 'M6 9V3h12v6 M6 18H4v-7h16v7h-2 M6 14h12v7H6z',
  cpu: 'M6 6h12v12H6z M9 9h6v6H9z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
  code: 'm8 8-5 4 5 4 M16 8l5 4-5 4 M14 5l-4 14',
  wrench:
    'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
};
const ICON_BY_KEY: Record<string, string> = {
  laptop: P.monitor, computer: P.monitor, monitor: P.monitor,
  phone: P.phone, tablet: P.phone,
  router: P.wifi, network: P.wifi, wifi: P.wifi,
  camera: P.camera, cctv: P.camera,
  printer: P.printer,
  server: P.cpu, storage: P.cpu, keyboard: P.cpu, mouse: P.cpu, headset: P.cpu,
  battery: P.cpu, ups: P.cpu, cable: P.cpu, accessory: P.cpu,
  security: P.shield,
  software: P.code, cloud: P.code, game: P.code,
  service: P.wrench, tools: P.wrench,
};
export const iconPath = (key: string): string => ICON_BY_KEY[key.trim().toLowerCase()] ?? P.grid;

const COLORS: Record<string, string> = {
  blue: '#1E6FD9', green: '#16A34A', purple: '#9333EA', red: '#E11D48', indigo: '#4F46E5',
  amber: '#F59E0B', teal: '#0D9488', sky: '#0284C7', orange: '#F97316', pink: '#DB2777',
};
const AUTO = Object.values(COLORS);

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Platform Admin's colour, else one that stays the same for this category. */
export const categoryColor = (c: Category | undefined, fallbackId = ''): string =>
  (c && COLORS[c.color.trim().toLowerCase()]) || AUTO[hash(c?.id ?? fallbackId) % AUTO.length];
