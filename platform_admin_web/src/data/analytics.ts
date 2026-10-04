import { csvCell, toCsv } from './csv';
import type { Customer, Order, OrderCancelReason } from './types';

export { csvCell };

/*
 * The figures behind the Analytics page. Pure functions over documents that
 * were already read and mapped, so each rule is testable and the page only
 * lays the results out.
 *
 * Definitions (the page prints the same ones):
 *  - An order belongs to the period / month it was PLACED in (createdAt).
 *  - A CONFIRMED SALE is an order whose payment was confirmed and that was not
 *    cancelled. Its total includes delivery and installation fees, which are
 *    also reported on their own (the rules guarantee total = products +
 *    installation + delivery). Only confirmed sales count as sales.
 *  - AWAITING CONFIRMATION is an order that is not cancelled and whose payment
 *    is not confirmed yet. It is never a sale. After 24 hours it is overdue and
 *    will expire (the company's app cancels it when its Orders page is opened,
 *    so an expired order can sit as "processing" for a while).
 *  - CANCEL RATE = cancelled orders / orders placed in the period.
 *  - All amounts are Sudanese pounds (the rules only allow SDG).
 *  - Calendar months follow Khartoum time, whoever opens the dashboard.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The payment-verification window after which an unconfirmed order expires. */
export const PAYMENT_WINDOW_HOURS = 24;
/** Months are cut at midnight in Sudan (UTC+2, no daylight saving). */
export const BUSINESS_TIME_ZONE = 'Africa/Khartoum';

export type Period = '7d' | '30d' | '90d' | '12m' | 'all';
export const PERIODS: Period[] = ['7d', '30d', '90d', '12m', 'all'];
const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };

/** True when the date falls in the period ending now. "All" keeps everything, even an order with no date. */
export function inPeriod(date: Date | null, period: Period, now: number): boolean {
  if (period === 'all') return true;
  if (!date) return false;
  const age = now - date.getTime();
  return age >= 0 && age <= PERIOD_DAYS[period] * DAY;
}

export const ordersInPeriod = (orders: readonly Order[], period: Period, now: number): Order[] =>
  orders.filter((o) => inPeriod(o.createdAt, period, now));

/** Orders that can never appear in a dated period (they carry no creation time). */
export const undatedOrders = (orders: readonly Order[]): number => orders.filter((o) => o.createdAt === null).length;

const isCancelled = (o: Order) => o.orderStatus === 'cancelled';

/** Payment confirmed and not cancelled: the only orders that count as sales. */
export const isConfirmedSale = (o: Order): boolean => o.paymentStatus === 'confirmed' && !isCancelled(o);

/** Not cancelled and payment not confirmed yet. */
export const isAwaitingConfirmation = (o: Order): boolean => o.paymentStatus !== 'confirmed' && !isCancelled(o);

const isOverdue = (o: Order, now: number): boolean =>
  isAwaitingConfirmation(o) && o.createdAt !== null && now - o.createdAt.getTime() > PAYMENT_WINDOW_HOURS * HOUR;

/** What the order's total is made of: the rules keep total = products + installation + delivery. */
export function orderParts(o: Order): { products: number; installation: number; delivery: number } {
  // Products is derived from the total, so the three always add up to it.
  return {
    products: o.totalAmount - o.installationFee - o.deliveryFee,
    installation: o.installationFee,
    delivery: o.deliveryFee,
  };
}

export interface OrderSummary {
  /** Every order placed in the period, whatever became of it. */
  orders: number;
  confirmedOrders: number;
  /** Total of the confirmed sales, delivery and installation included. */
  confirmedSales: number;
  /** The confirmed sales split into what they are made of; the three add up to confirmedSales. */
  products: number;
  installation: number;
  delivery: number;
  /** confirmedSales / confirmedOrders; null when there are none. */
  averageOrder: number | null;
  awaitingOrders: number;
  awaitingValue: number;
  /** Of those awaiting confirmation, the ones past the 24 hours (they will expire). */
  overdueOrders: number;
  processing: number;
  completed: number;
  cancelled: number;
  /** cancelled / orders, 0..1; null when there are no orders. */
  cancelRate: number | null;
}

export function summarizeOrders(orders: readonly Order[], now: number): OrderSummary {
  const sales = orders.filter(isConfirmedSale);
  const awaiting = orders.filter(isAwaitingConfirmation);
  const parts = sales.map(orderParts);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const confirmedSales = sum(sales.map((o) => o.totalAmount));
  const cancelled = orders.filter(isCancelled).length;
  return {
    orders: orders.length,
    confirmedOrders: sales.length,
    confirmedSales,
    products: sum(parts.map((p) => p.products)),
    installation: sum(parts.map((p) => p.installation)),
    delivery: sum(parts.map((p) => p.delivery)),
    averageOrder: sales.length > 0 ? confirmedSales / sales.length : null,
    awaitingOrders: awaiting.length,
    awaitingValue: sum(awaiting.map((o) => o.totalAmount)),
    overdueOrders: orders.filter((o) => isOverdue(o, now)).length,
    processing: orders.filter((o) => o.orderStatus === 'processing').length,
    completed: orders.filter((o) => o.orderStatus === 'completed').length,
    cancelled,
    cancelRate: orders.length > 0 ? cancelled / orders.length : null,
  };
}

export interface RankRow {
  id: string;
  name: string;
  /** Confirmed orders. */
  orders: number;
  units: number;
  /** Confirmed sales. */
  sales: number;
}

function rank(
  orders: readonly Order[],
  keyOf: (o: Order) => string,
  nameOf: (o: Order) => string,
  limit: number,
): RankRow[] {
  const rows = new Map<string, RankRow>();
  for (const o of orders) {
    if (!isConfirmedSale(o)) continue;
    const id = keyOf(o);
    if (!id) continue;
    const row = rows.get(id) ?? { id, name: nameOf(o) || id, orders: 0, units: 0, sales: 0 };
    row.orders += 1;
    row.units += o.quantity;
    row.sales += o.totalAmount;
    // An earlier order may have had no name; take the first one that does.
    if (row.name === id) row.name = nameOf(o) || row.name;
    rows.set(id, row);
  }
  return [...rows.values()]
    .sort((a, b) => b.sales - a.sales || b.orders - a.orders || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Companies by confirmed sales. */
export const topCompanies = (orders: readonly Order[], limit = 10): RankRow[] =>
  rank(orders, (o) => o.companyId, (o) => o.companyName, limit);

/** Products by confirmed sales. */
export const topProducts = (orders: readonly Order[], limit = 10): RankRow[] =>
  rank(orders, (o) => o.productId, (o) => o.productName, limit);

export type CancelBucket = OrderCancelReason | 'unknown';
export const CANCEL_BUCKETS: CancelBucket[] = ['company', 'expired', 'out_of_stock', 'admin', 'unknown'];

/** Cancelled orders by why; an old cancelled order that stored no reason is "unknown". */
export function cancelReasons(orders: readonly Order[]): Record<CancelBucket, number> {
  const counts: Record<CancelBucket, number> = { company: 0, expired: 0, out_of_stock: 0, admin: 0, unknown: 0 };
  for (const o of orders) {
    if (isCancelled(o)) counts[o.cancelReason ?? 'unknown'] += 1;
  }
  return counts;
}

/* ---------- Calendar months in Khartoum time ---------- */

const monthParts = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
});

/** The calendar month (month is 0-11) a moment falls in, in Khartoum time. */
export function businessMonth(date: Date): { year: number; month: number } {
  const parts = monthParts.formatToParts(date);
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: read('year'), month: read('month') - 1 };
}

export interface MonthPoint {
  year: number;
  /** 0-11. */
  month: number;
  /** Midnight UTC on the 1st, only for labelling the month (format it with timeZone 'UTC'). */
  label: Date;
  orders: number;
  /** Confirmed sales of the orders placed that month. */
  sales: number;
  newCustomers: number;
}

/** Calendar months, oldest first, ending with the month of `now`. */
export function monthlySeries(
  orders: readonly Order[],
  customers: readonly Customer[],
  months: number,
  now: number,
): MonthPoint[] {
  const current = businessMonth(new Date(now));
  const points: MonthPoint[] = Array.from({ length: months }, (_, i) => {
    const label = new Date(Date.UTC(current.year, current.month - (months - 1 - i), 1));
    return { year: label.getUTCFullYear(), month: label.getUTCMonth(), label, orders: 0, sales: 0, newCustomers: 0 };
  });
  const find = (d: Date) => {
    const m = businessMonth(d);
    return points.find((p) => p.year === m.year && p.month === m.month);
  };
  for (const o of orders) {
    const point = o.createdAt && find(o.createdAt);
    if (!point) continue;
    point.orders += 1;
    if (isConfirmedSale(o)) point.sales += o.totalAmount;
  }
  for (const c of customers) {
    const point = c.createdAt && find(c.createdAt);
    if (point) point.newCustomers += 1;
  }
  return points;
}

/* ---------- CSV export ---------- */

const CSV_HEADER = [
  'order_id',
  'created_at',
  'customer',
  'company',
  'product',
  'quantity',
  'products_amount',
  'installation_fee',
  'delivery_fee',
  'total',
  'payment_status',
  'order_status',
  'cancel_reason',
];

/** The orders as CSV text (UTF-8 with a BOM so Excel reads Arabic), in the order given. */
export function ordersToCsv(orders: readonly Order[]): string {
  return toCsv(
    CSV_HEADER,
    orders.map((o) => {
      const parts = orderParts(o);
      return [
        o.id,
        o.createdAt ? o.createdAt.toISOString() : '',
        o.customerName || o.customerId,
        o.companyName,
        o.productName,
        o.quantity,
        parts.products,
        parts.installation,
        parts.delivery,
        o.totalAmount,
        o.paymentStatus,
        o.orderStatus,
        o.cancelReason ?? '',
      ];
    }),
  );
}

/* ---------- Sales CSV (the same period as the orders file) ---------- */

const dayParts = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** The calendar day (2026-10-05) a moment falls in, in Khartoum time. */
export const businessDay = (date: Date): string => dayParts.format(date);

/** One row per day an order was placed (oldest first): how many, and what was confirmed, awaiting, cancelled. */
export function salesByDayToCsv(orders: readonly Order[]): string {
  const days = new Map<string, { orders: number; confirmed: number; sales: number; awaiting: number; cancelled: number }>();
  for (const o of orders) {
    if (!o.createdAt) continue;
    const key = businessDay(o.createdAt);
    const row = days.get(key) ?? { orders: 0, confirmed: 0, sales: 0, awaiting: 0, cancelled: 0 };
    row.orders += 1;
    if (isConfirmedSale(o)) {
      row.confirmed += 1;
      row.sales += o.totalAmount;
    } else if (isAwaitingConfirmation(o)) row.awaiting += 1;
    if (isCancelled(o)) row.cancelled += 1;
    days.set(key, row);
  }
  return toCsv(
    ['date', 'orders', 'confirmed_orders', 'confirmed_sales', 'awaiting_confirmation', 'cancelled'],
    [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, r]) => [day, r.orders, r.confirmed, r.sales, r.awaiting, r.cancelled]),
  );
}

const rankToCsv = (idHeader: string, nameHeader: string, rows: readonly RankRow[]): string =>
  toCsv(
    [idHeader, nameHeader, 'confirmed_orders', 'units', 'confirmed_sales'],
    rows.map((r) => [r.id, r.name, r.orders, r.units, r.sales]),
  );

/** Every company with a confirmed sale in the period, best first (no top-10 cut). */
export const salesByCompanyToCsv = (orders: readonly Order[]): string =>
  rankToCsv('company_id', 'company', topCompanies(orders, Infinity));

/** Every product with a confirmed sale in the period, best first. */
export const salesByProductToCsv = (orders: readonly Order[]): string =>
  rankToCsv('product_id', 'product', topProducts(orders, Infinity));
