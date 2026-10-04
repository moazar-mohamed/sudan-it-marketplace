import { describe, expect, it } from 'vitest';
import {
  businessMonth,
  cancelReasons,
  csvCell,
  inPeriod,
  isAwaitingConfirmation,
  isConfirmedSale,
  monthlySeries,
  orderParts,
  ordersInPeriod,
  ordersToCsv,
  salesByCompanyToCsv,
  salesByDayToCsv,
  salesByProductToCsv,
  summarizeOrders,
  topCompanies,
  topProducts,
  undatedOrders,
} from './analytics';
import { mapCustomer, mapOrder } from './mappers';
import { compareWindows } from './stats';

const NOW = Date.UTC(2026, 9, 15, 10); // 15 Oct 2026, 12:00 in Khartoum
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);
const daysAgo = (d: number) => hoursAgo(d * 24);

/** A valid order: total = products + installation + delivery, as the rules require. */
const order = (extra: Record<string, unknown>) => {
  const products = (extra.products as number | undefined) ?? 100;
  const installationFee = (extra.installationFee as number | undefined) ?? 0;
  const deliveryFee = (extra.deliveryFee as number | undefined) ?? 0;
  const { products: _products, ...rest } = extra;
  void _products;
  return mapOrder(String(extra.id ?? 'o'), {
    customerId: 'u1',
    companyId: 'c1',
    companyName: 'Nile Co',
    productId: 'p1',
    productName: 'Router',
    quantity: 1,
    productSubtotal: products,
    installationFee,
    deliveryFee,
    totalAmount: products + installationFee + deliveryFee,
    orderStatus: 'completed',
    paymentStatus: 'confirmed',
    createdAt: daysAgo(1),
    ...rest,
  });
};

describe('periods', () => {
  it('keeps dates inside the window and drops older, future and undated ones', () => {
    expect(inPeriod(daysAgo(6), '7d', NOW)).toBe(true);
    expect(inPeriod(daysAgo(8), '7d', NOW)).toBe(false);
    expect(inPeriod(daysAgo(89), '90d', NOW)).toBe(true);
    expect(inPeriod(daysAgo(300), '12m', NOW)).toBe(true);
    expect(inPeriod(daysAgo(400), '12m', NOW)).toBe(false);
    expect(inPeriod(new Date(NOW + 1000), '30d', NOW)).toBe(false);
    expect(inPeriod(null, '30d', NOW)).toBe(false);
  });

  it('"all" keeps everything, an undated order too, and undated orders can be counted', () => {
    const orders = [order({ id: 'a' }), order({ id: 'b', createdAt: undefined })];
    expect(ordersInPeriod(orders, 'all', NOW)).toHaveLength(2);
    expect(ordersInPeriod(orders, '30d', NOW)).toHaveLength(1);
    expect(undatedOrders(orders)).toBe(1);
  });
});

describe('what counts as a sale', () => {
  it('only a confirmed, not cancelled order is a sale', () => {
    expect(isConfirmedSale(order({}))).toBe(true);
    expect(isConfirmedSale(order({ orderStatus: 'processing' }))).toBe(true);
    expect(isConfirmedSale(order({ paymentStatus: 'pending_verification', orderStatus: 'processing' }))).toBe(false);
    expect(isConfirmedSale(order({ orderStatus: 'cancelled' }))).toBe(false);
  });

  it('awaiting confirmation is the unconfirmed, not cancelled order, and never a sale', () => {
    const waiting = order({ paymentStatus: 'pending_verification', orderStatus: 'processing' });
    expect(isAwaitingConfirmation(waiting)).toBe(true);
    expect(isConfirmedSale(waiting)).toBe(false);
    expect(isAwaitingConfirmation(order({ paymentStatus: 'pending_verification', orderStatus: 'cancelled' }))).toBe(false);
    expect(isAwaitingConfirmation(order({}))).toBe(false);
  });
});

describe('summary', () => {
  const orders = [
    order({ id: 'a', products: 100, deliveryFee: 20 }), // confirmed, completed: 120
    order({ id: 'b', products: 300, installationFee: 50, orderStatus: 'out_for_delivery' }), // confirmed: 350
    order({ id: 'w1', products: 200, paymentStatus: 'pending_verification', orderStatus: 'processing', createdAt: hoursAgo(5) }),
    order({ id: 'w2', products: 40, paymentStatus: 'pending_verification', orderStatus: 'processing', createdAt: hoursAgo(30) }),
    order({ id: 'c', products: 900, orderStatus: 'cancelled', cancelReason: 'company' }),
    order({ id: 'd', products: 70, orderStatus: 'cancelled', cancelReason: 'expired', paymentStatus: 'pending_verification' }),
  ];

  it('counts only confirmed orders as sales, and shows the rest separately', () => {
    const s = summarizeOrders(orders, NOW);
    expect(s.orders).toBe(6);
    expect(s.confirmedOrders).toBe(2);
    expect(s.confirmedSales).toBe(470);
    expect(s.awaitingOrders).toBe(2);
    expect(s.awaitingValue).toBe(240);
    expect(s.overdueOrders).toBe(1); // w2 is past 24 hours, w1 is not
  });

  it('splits the confirmed sales into products, installation and delivery that add up', () => {
    const s = summarizeOrders(orders, NOW);
    expect([s.products, s.installation, s.delivery]).toEqual([400, 50, 20]);
    expect(s.products + s.installation + s.delivery).toBe(s.confirmedSales);
  });

  it('averages over the confirmed orders only', () => {
    expect(summarizeOrders(orders, NOW).averageOrder).toBe(235);
  });

  it('counts statuses and the cancel rate over every order placed', () => {
    const s = summarizeOrders(orders, NOW);
    expect(s.completed).toBe(1);
    expect(s.processing).toBe(2);
    expect(s.cancelled).toBe(2);
    expect(s.cancelRate).toBeCloseTo(2 / 6);
  });

  it('has no average or rate when there is nothing to divide by', () => {
    expect(summarizeOrders([], NOW)).toMatchObject({ orders: 0, confirmedSales: 0, averageOrder: null, cancelRate: null });
    expect(summarizeOrders([order({ orderStatus: 'cancelled' })], NOW).averageOrder).toBeNull();
    expect(summarizeOrders([order({ paymentStatus: 'pending_verification', orderStatus: 'processing' })], NOW).averageOrder).toBeNull();
  });

  it('derives the product part from the total so an older order still adds up', () => {
    // An older order with no stored subtotal.
    const legacy = mapOrder('l', { customerId: 'u', totalAmount: 150, deliveryFee: 30, paymentStatus: 'confirmed', orderStatus: 'completed' });
    expect(orderParts(legacy)).toEqual({ products: 120, installation: 0, delivery: 30 });
  });
});

describe('rankings', () => {
  const orders = [
    order({ id: '1', companyId: 'c1', companyName: 'Nile Co', productId: 'p1', productName: 'Router', quantity: 2, products: 200 }),
    order({ id: '2', companyId: 'c2', companyName: 'Blue Co', productId: 'p2', productName: 'Switch', products: 500 }),
    order({ id: '3', companyId: 'c1', companyName: 'Nile Co', productId: 'p1', productName: 'Router', products: 100 }),
    order({ id: '4', companyId: 'c3', companyName: 'Gone Co', productId: 'p3', productName: 'Cable', products: 9999, orderStatus: 'cancelled' }),
    order({ id: '5', companyId: 'c4', companyName: 'Slow Co', productId: 'p4', productName: 'Rack', products: 8000, paymentStatus: 'pending_verification', orderStatus: 'processing' }),
  ];

  it('ranks companies by confirmed sales: cancelled and unconfirmed orders are not sales', () => {
    expect(topCompanies(orders).map((r) => [r.id, r.orders, r.units, r.sales])).toEqual([
      ['c2', 1, 1, 500],
      ['c1', 2, 3, 300],
    ]);
  });

  it('ranks products the same way and honours the limit', () => {
    expect(topProducts(orders).map((r) => r.name)).toEqual(['Switch', 'Router']);
    expect(topProducts(orders, 1)).toHaveLength(1);
  });

  it('falls back to the id when no order carries a name, and skips orders with no id', () => {
    const rows = topCompanies([order({ id: 'x', companyId: 'c9', companyName: '' }), order({ id: 'y', companyId: '' })]);
    expect(rows).toEqual([{ id: 'c9', name: 'c9', orders: 1, units: 1, sales: 100 }]);
  });

  it('breaks a tie on sales by order count, then by name', () => {
    const tie = [
      order({ id: '1', companyId: 'a', companyName: 'Zed', products: 100 }),
      order({ id: '2', companyId: 'b', companyName: 'Alpha', products: 100 }),
    ];
    expect(topCompanies(tie).map((r) => r.name)).toEqual(['Alpha', 'Zed']);
  });
});

describe('cancel reasons', () => {
  it('counts each reason and files a missing one as unknown', () => {
    const counts = cancelReasons([
      order({ orderStatus: 'cancelled', cancelReason: 'company' }),
      order({ orderStatus: 'cancelled', cancelReason: 'out_of_stock' }),
      order({ orderStatus: 'cancelled', cancelReason: 'out_of_stock' }),
      order({ orderStatus: 'cancelled' }),
      order({ orderStatus: 'completed' }),
    ]);
    expect(counts).toEqual({ company: 1, expired: 0, out_of_stock: 2, admin: 0, unknown: 1 });
  });
});

describe('calendar months follow Khartoum time', () => {
  it('assigns a moment to the month it is in Khartoum, not in UTC', () => {
    // 22:30 UTC on 30 Sep is 00:30 on 1 Oct in Khartoum (UTC+2).
    expect(businessMonth(new Date(Date.UTC(2026, 8, 30, 22, 30)))).toEqual({ year: 2026, month: 9 });
    expect(businessMonth(new Date(Date.UTC(2026, 8, 30, 21, 59)))).toEqual({ year: 2026, month: 8 });
    expect(businessMonth(new Date(Date.UTC(2026, 11, 31, 22, 0)))).toEqual({ year: 2027, month: 0 });
  });

  it('gives months oldest first, ending with this month, across a year boundary too', () => {
    expect(monthlySeries([], [], 3, NOW).map((p) => [p.year, p.month])).toEqual([[2026, 7], [2026, 8], [2026, 9]]);
    const jan = Date.UTC(2026, 0, 10, 10);
    expect(monthlySeries([], [], 3, jan).map((p) => [p.year, p.month])).toEqual([[2025, 10], [2025, 11], [2026, 0]]);
  });

  it('uses Khartoum time for "this month" itself', () => {
    // 23:30 UTC on 30 Sep is already October in Khartoum.
    const lateSep = Date.UTC(2026, 8, 30, 23, 30);
    expect(monthlySeries([], [], 1, lateSep)[0]).toMatchObject({ year: 2026, month: 9 });
  });

  it('puts orders, confirmed sales and new customers in their month', () => {
    const points = monthlySeries(
      [
        order({ id: 'a', createdAt: new Date(Date.UTC(2026, 9, 2, 8)), products: 100 }),
        order({ id: 'b', createdAt: new Date(Date.UTC(2026, 9, 3, 8)), products: 50, orderStatus: 'cancelled' }),
        order({ id: 'u', createdAt: new Date(Date.UTC(2026, 9, 4, 8)), products: 30, paymentStatus: 'pending_verification', orderStatus: 'processing' }),
        order({ id: 'c', createdAt: new Date(Date.UTC(2026, 8, 20, 8)), products: 70 }),
        order({ id: 'd', createdAt: new Date(Date.UTC(2020, 0, 1)) }), // outside the window
        order({ id: 'e', createdAt: undefined }),
        // 22:30 UTC on 30 Sep: October in Khartoum.
        order({ id: 'edge', createdAt: new Date(Date.UTC(2026, 8, 30, 22, 30)), products: 10 }),
      ],
      [mapCustomer('u1', { role: 'customer', createdAt: new Date(Date.UTC(2026, 9, 1, 8)) }), mapCustomer('u2', { role: 'customer' })],
      2,
      NOW,
    );
    expect(points.map((p) => [p.orders, p.sales, p.newCustomers])).toEqual([
      [1, 70, 0],
      [4, 110, 1],
    ]);
  });
});

describe('the figures reconcile, whatever the data', () => {
  // A deterministic pseudo-random set of valid orders in every state.
  function random(seed: number) {
    let x = seed;
    const next = () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)];
    return Array.from({ length: 300 }, (_, i) => {
      const status = pick(['processing', 'out_for_delivery', 'completed', 'cancelled']);
      return order({
        id: `o${i}`,
        companyId: pick(['c1', 'c2', 'c3', 'c4']),
        companyName: pick(['A', 'B', 'C', 'D']),
        productId: pick(['p1', 'p2', 'p3', 'p4', 'p5']),
        quantity: 1 + Math.floor(next() * 4),
        products: 10 + Math.floor(next() * 500),
        installationFee: pick([0, 0, 25, 60]),
        deliveryFee: pick([0, 15, 15]),
        orderStatus: status,
        paymentStatus: status === 'cancelled' ? pick(['confirmed', 'pending_verification']) : pick(['confirmed', 'confirmed', 'pending_verification']),
        cancelReason: status === 'cancelled' ? pick(['company', 'expired', 'out_of_stock', undefined]) : undefined,
        createdAt: next() < 0.05 ? undefined : hoursAgo(next() * 24 * 400),
      });
    });
  }

  for (const seed of [1, 7, 42, 2026]) {
    it(`seed ${seed}`, () => {
      const orders = random(seed);
      const s = summarizeOrders(orders, NOW);

      // Every order is exactly one of: confirmed sale, awaiting, cancelled.
      expect(s.confirmedOrders + s.awaitingOrders + s.cancelled).toBe(s.orders);
      // Statuses partition the orders.
      const outForDelivery = orders.filter((o) => o.orderStatus === 'out_for_delivery').length;
      expect(s.processing + outForDelivery + s.completed + s.cancelled).toBe(s.orders);
      // The sale splits add up exactly.
      expect(s.products + s.installation + s.delivery).toBeCloseTo(s.confirmedSales, 6);
      // Cancelled orders by reason add up to the cancelled count.
      expect(Object.values(cancelReasons(orders)).reduce((a, b) => a + b, 0)).toBe(s.cancelled);
      // Overdue orders are a subset of the awaiting ones.
      expect(s.overdueOrders).toBeLessThanOrEqual(s.awaitingOrders);

      // Ranking every company (no limit) accounts for all the confirmed sales.
      const byCompany = topCompanies(orders, 1000);
      expect(byCompany.reduce((a, r) => a + r.sales, 0)).toBeCloseTo(s.confirmedSales, 6);
      expect(byCompany.reduce((a, r) => a + r.orders, 0)).toBe(s.confirmedOrders);
      const byProduct = topProducts(orders, 1000);
      expect(byProduct.reduce((a, r) => a + r.sales, 0)).toBeCloseTo(s.confirmedSales, 6);
      expect(byProduct.reduce((a, r) => a + r.units, 0)).toBe(byCompany.reduce((a, r) => a + r.units, 0));

      // The 12 monthly buckets plus what falls outside them plus undated orders is every order.
      const months = monthlySeries(orders, [], 12, NOW);
      const inWindow = months.reduce((a, m) => a + m.orders, 0);
      const outside = orders.filter((o) => o.createdAt && !months.some((m) => {
        const b = businessMonth(o.createdAt!);
        return b.year === m.year && b.month === m.month;
      })).length;
      expect(inWindow + outside + undatedOrders(orders)).toBe(orders.length);
      // Monthly sales are the confirmed sales of the dated orders in the window.
      const windowSales = orders
        .filter((o) => o.createdAt && months.some((m) => {
          const b = businessMonth(o.createdAt!);
          return b.year === m.year && b.month === m.month;
        }))
        .filter(isConfirmedSale)
        .reduce((a, o) => a + o.totalAmount, 0);
      expect(months.reduce((a, m) => a + m.sales, 0)).toBeCloseTo(windowSales, 6);

      // Narrower periods are contained in wider ones, and 'all' is everything.
      const counts = (['7d', '30d', '90d', '12m', 'all'] as const).map((p) => ordersInPeriod(orders, p, NOW).length);
      expect([...counts].sort((a, b) => a - b)).toEqual(counts);
      expect(counts[4]).toBe(orders.length);
    });
  }
});

describe('the dashboard and the analytics page agree', () => {
  it('give the same orders and confirmed sales for the last 30 days', () => {
    const orders = Array.from({ length: 120 }, (_, i) =>
      order({
        id: `o${i}`,
        products: 10 + i,
        orderStatus: i % 5 === 0 ? 'cancelled' : 'completed',
        paymentStatus: i % 3 === 0 ? 'pending_verification' : 'confirmed',
        createdAt: hoursAgo(i * 13),
      }),
    );
    const placed = compareWindows(orders, (o) => o.createdAt, NOW).current;
    const sales = compareWindows(orders.filter(isConfirmedSale), (o) => o.createdAt, NOW, (o) => o.totalAmount).current;
    const inThirty = ordersInPeriod(orders, '30d', NOW);
    expect(placed).toBe(inThirty.length);
    expect(sales).toBe(summarizeOrders(inThirty, NOW).confirmedSales);
  });
});

describe('CSV', () => {
  it('wraps cells that need it and doubles quotes', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(12.5)).toBe('12.5');
  });

  it('keeps text a spreadsheet would run as a formula as text', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    // A number is data, not a formula.
    expect(csvCell(-5)).toBe('-5');
  });

  it('writes a header and one row per order, split into its parts, with a BOM for Excel', () => {
    const csv = ordersToCsv([
      order({
        id: 'o1',
        customerName: 'Sara, Jr',
        createdAt: new Date('2026-10-14T10:00:00Z'),
        products: 100,
        installationFee: 20,
        deliveryFee: 5,
        orderStatus: 'cancelled',
        cancelReason: 'expired',
      }),
    ]);
    expect(csv.startsWith('﻿order_id,created_at')).toBe(true);
    const [header, row] = csv.slice(1).split('\r\n');
    expect(header.split(',')).toHaveLength(13);
    expect(row).toBe('o1,2026-10-14T10:00:00.000Z,"Sara, Jr",Nile Co,Router,1,100,20,5,125,confirmed,cancelled,expired');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('writes only the header for no orders', () => {
    expect(ordersToCsv([]).split('\r\n')).toHaveLength(2);
  });
});

describe('the sales files', () => {
  const lines = (csv: string) => csv.slice(1).split(String.fromCharCode(13, 10)).filter((l) => l !== '');

  it('sales by day: one row per day an order was placed (Khartoum days), oldest first, with confirmed, awaiting and cancelled apart', () => {
    const csv = salesByDayToCsv([
      // 22:30 UTC on the 13th is already the 14th in Khartoum (UTC+2)
      order({ id: 'a', createdAt: new Date('2026-10-13T22:30:00Z'), products: 100 }),
      order({ id: 'b', createdAt: new Date('2026-10-14T08:00:00Z'), products: 50 }),
      order({ id: 'c', createdAt: new Date('2026-10-14T09:00:00Z'), paymentStatus: 'pending_verification' }),
      order({ id: 'd', createdAt: new Date('2026-10-14T10:00:00Z'), orderStatus: 'cancelled', cancelReason: 'expired' }),
      order({ id: 'e', createdAt: new Date('2026-10-12T10:00:00Z'), products: 70 }),
      order({ id: 'undated', createdAt: null }),
    ]);
    expect(lines(csv)).toEqual([
      'date,orders,confirmed_orders,confirmed_sales,awaiting_confirmation,cancelled',
      '2026-10-12,1,1,70,0,0',
      '2026-10-14,4,2,150,1,1',
    ]);
  });

  it('sales by company and by product: every one with a confirmed sale, best first, not only the top ten', () => {
    const many = Array.from({ length: 12 }, (_, i) => order({ id: `o${i}`, companyId: `c${i}`, companyName: `Co ${i}`, productId: `p${i}`, productName: `Item ${i}`, products: 100 + i }));
    const byCompany = lines(salesByCompanyToCsv(many));
    expect(byCompany[0]).toBe('company_id,company,confirmed_orders,units,confirmed_sales');
    expect(byCompany).toHaveLength(1 + 12);
    expect(byCompany[1]).toBe('c11,Co 11,1,1,111');
    expect(lines(salesByProductToCsv(many))[1]).toBe('p11,Item 11,1,1,111');
  });

  it('an order that was not confirmed or was cancelled is not a sale', () => {
    const csv = salesByCompanyToCsv([order({ id: 'x', paymentStatus: 'pending_verification' }), order({ id: 'y', orderStatus: 'cancelled' })]);
    expect(lines(csv)).toHaveLength(1);
  });
});
