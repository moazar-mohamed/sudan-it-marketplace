import { PAYMENT_WINDOW_MS, type Order, type Product } from './types';

/** 1465000 → "1,465,000" (whole numbers, as in the app). */
export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

export const withCurrency = (value: number | null | undefined, currency = 'SDG'): string =>
  value === null || value === undefined ? '—' : `${money(value)} ${currency}`;

/** The short reference people read out for an order: the first 8 characters of its id. */
export const shortId = (id: string): string => (id.length > 8 ? id.slice(0, 8) : id);

const pad = (n: number) => String(n).padStart(2, '0');

export function dateTime(d: Date | null): string {
  if (!d) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "اليوم 09:12", "أمس 17:20", else "30 أكتوبر". */
export function dayTime(d: Date | null, now = new Date()): string {
  if (!d) return '—';
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay(d, now)) return `اليوم ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `أمس ${time}`;
  return d.toLocaleDateString('ar-SD-u-nu-latn', { day: 'numeric', month: 'long' });
}

export function longDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('ar-SD-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** "قبل 12 د" / "قبل ساعتين" / "قبل 3 أيام". */
export function ago(d: Date | null, now = new Date()): string {
  if (!d) return '';
  const minutes = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `قبل ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'قبل ساعة' : hours === 2 ? 'قبل ساعتين' : `قبل ${hours} ساعات`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'قبل يوم' : days === 2 ? 'قبل يومين' : `قبل ${days} أيام`;
}

/** The time left until the payment window of [order] closes, in ms (negative once it has). */
export const paymentTimeLeft = (order: Order, now = Date.now()): number =>
  order.createdAt.getTime() + PAYMENT_WINDOW_MS - now;

/** "4س 20د" for a positive duration; "انتهت" when it ran out. */
export function leftLabel(ms: number): string {
  if (ms <= 0) return 'انتهت';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return `${hours}س ${pad(minutes % 60)}د`;
}

export type Urgency = 'bad' | 'warn' | 'n';
/** Red under 6 hours, amber under 12. */
export const urgencyOf = (ms: number): Urgency => (ms < 6 * 3600000 ? 'bad' : ms < 12 * 3600000 ? 'warn' : 'n');

// ── Offers (mirror lib/features/offers/domain/offer_pricing.dart) ──────────

interface Priced {
  price: number | null;
  offerPrice: number | null;
  offerEndsAt: Date | null;
}

export const hasOffer = (p: Priced): boolean =>
  p.offerPrice !== null && p.price !== null && p.offerPrice < p.price;

export const hasActiveOffer = (p: Priced, now = Date.now()): boolean =>
  hasOffer(p) && (p.offerEndsAt === null || now < p.offerEndsAt.getTime());

export const hasEndedOffer = (p: Priced, now = Date.now()): boolean => hasOffer(p) && !hasActiveOffer(p, now);

export const salePrice = (p: Priced, now = Date.now()): number | null => (hasActiveOffer(p, now) ? p.offerPrice : p.price);

export const discountPercent = (p: Priced): number =>
  hasOffer(p) ? Math.round((1 - (p.offerPrice as number) / (p.price as number)) * 100) : 0;

// ── Stock ──────────────────────────────────────────────────────────────────

/** A product with this many units or fewer counts as low on stock (the app uses the same 3). */
export const LOW_STOCK_THRESHOLD = 3;

/** The warning level of one product: its own when the company set one, else the default. */
export const lowLevelOf = (p: { lowStockThreshold: number | null }): number => p.lowStockThreshold ?? LOW_STOCK_THRESHOLD;
/** Stock is at or under the product's warning level (out of stock counts). */
export const isLowStock = (p: { stockCount: number; lowStockThreshold: number | null }): boolean => p.stockCount <= lowLevelOf(p);

/** Units remain. */
export const hasStock = (p: Pick<Product, 'stockCount'>): boolean => p.stockCount > 0;
/** Marked in stock and units remain. */
export const isAvailable = (p: Pick<Product, 'stockCount' | 'inStock'>): boolean => p.inStock && p.stockCount > 0;

/** Arabic counted nouns: 0 → "لا …", 1, 2 (dual), 3–10 plural, 11+ singular accusative. */
export const arCount = (n: number, one: string, two: string, few: string, many: string): string =>
  n === 0 ? `لا ${few}` : n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`;
export const unitsText = (n: number): string => arCount(n, 'وحدة واحدة', 'وحدتان', 'وحدات', 'وحدة');
export const productsText = (n: number): string => arCount(n, 'منتج واحد', 'منتجان', 'منتجات', 'منتجًا');
export const ordersText = (n: number): string => arCount(n, 'طلب واحد', 'طلبان', 'طلبات', 'طلبًا');

/** Arabic-Indic and Persian digits → 0-9 (people type either). */
export const westernDigits = (s: string): string =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** "1,450,000" / "١٤٥٠٠٠٠" / "12.5" → number; null for empty or not a number. */
export function parseNumber(text: string): number | null {
  const clean = westernDigits(text).replace(/[,\s٬٫]/g, '').replace(/٫/g, '.');
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/** Digits only, for comparing or searching phone numbers. */
export const digitsOnly = (s: string): string => s.replace(/[^0-9]/g, '');

/** "+249912345678" → "0912 345 678"; anything else comes back as is. */
export function displayPhone(phone: string): string {
  const digits = digitsOnly(phone);
  if (phone.startsWith('+249') && digits.length === 12) {
    const n = digits.slice(3);
    return `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return phone;
}
