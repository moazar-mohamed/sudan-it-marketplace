// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapOrder } from '../data/mappers';
import type { Order } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { OrderDetailsPage } from './OrderDetailsPage';

/* ---- in-memory stand-in for the live collections; nothing reaches Firebase ---- */
const store = vi.hoisted(() => ({ orders: [] as unknown[] }));

vi.mock('../data/hooks', () => {
  const ready = (data: () => unknown[]) => () => ({
    status: 'ready' as const,
    error: null,
    retry: () => undefined,
    data: data() as never[],
  });
  return {
    useCompanies: ready(() => []),
    useProducts: ready(() => []),
  };
});
vi.mock('../data/orderHooks', () => ({
  useOrder: () => ({ status: 'ready' as const, error: null, order: (store.orders[0] as Order | undefined) ?? null, retry: () => undefined }),
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../data/receipts', () => ({ fetchOrderReceipt: vi.fn() }));

const cancelled = (fields: Record<string, unknown>): Order =>
  mapOrder('order-1', {
    customerName: 'Test Customer',
    companyName: 'Test Company',
    productName: 'Test Router',
    quantity: 2,
    orderStatus: 'cancelled',
    cancelledAt: new Date('2026-10-01T09:00:00Z'),
    ...fields,
  });

function renderOrder(order: Order, locale: 'en' | 'ar') {
  localStorage.setItem('platform_admin_locale', locale);
  store.orders = [order];
  return render(
    <MemoryRouter initialEntries={['/orders/order-1']}>
      <I18nProvider>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetailsPage />} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

/** The value shown next to [label] in the page's key/value lists. */
const valueOf = (label: string) => {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.nextElementSibling?.textContent ?? '';
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('order details: an order cancelled as out of stock', () => {
  const outOfStock = cancelled({
    paymentStatus: 'pending_verification',
    cancelReason: 'out_of_stock',
    stockReleased: false,
  });

  for (const [locale, dict] of [
    ['en', en],
    ['ar', ar],
  ] as const) {
    it(`shows why, says the company refunds outside the app, and that no stock was taken (${locale})`, () => {
      renderOrder(outOfStock, locale);
      expect(valueOf(dict['order.cancelReason'])).toBe(dict['order.cancel.out_of_stock']);
      expect(screen.queryByText(dict['order.cancel.company'])).toBeNull();
      expect(valueOf(dict['order.stockReturn'])).toBe(dict['order.stockNotReturned']);
      expect(screen.getByText(dict['payment.not_verified'])).toBeTruthy();
    });
  }
});

describe('order details: an order cancelled after its payment was confirmed', () => {
  const confirmedThenCancelled = cancelled({
    paymentStatus: 'confirmed',
    stockReserved: true,
    cancelReason: 'company',
    stockReleased: true,
  });

  for (const [locale, dict] of [
    ['en', en],
    ['ar', ar],
  ] as const) {
    it(`keeps the confirmed payment and says the stock went back (${locale})`, () => {
      renderOrder(confirmedThenCancelled, locale);
      expect(valueOf(dict['order.cancelReason'])).toBe(dict['order.cancel.company']);
      expect(valueOf(dict['order.stockReturn'])).toBe(dict['order.stockReturned']);
      expect(screen.getByText(dict['payment.confirmed'])).toBeTruthy();
      expect(screen.queryByText(dict['payment.not_verified'])).toBeNull();
    });
  }
});

describe('order details: a cancellation reason the admin does not know', () => {
  it('shows no reason rather than a wrong one', () => {
    renderOrder(cancelled({ cancelReason: 'made-up' }), 'en');
    expect(screen.queryByText(en['order.cancelReason'], { selector: 'dt' })).toBeNull();
    expect(screen.getByText(en['order.cancelledAt'], { selector: 'dt' })).toBeTruthy();
  });
});
