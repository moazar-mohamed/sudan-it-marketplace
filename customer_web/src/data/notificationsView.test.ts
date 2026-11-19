import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ db: {} }));

import { freshArrivals } from '../components/NoticeToast';
import { notificationKind, notificationTitle, splitByDay } from './notifications';
import type { AppNotification } from './types';

const note = (over: Partial<AppNotification>): AppNotification => ({
  id: 'n1',
  type: 'payment_confirmed',
  productName: 'Router',
  orderId: 'o1',
  serviceRequestId: '',
  reportId: '',
  isRead: false,
  createdAt: new Date(2026, 10, 18, 10, 0),
  ...over,
});

describe('the notifications page', () => {
  it('gives each kind of news its own picture and colour', () => {
    expect(notificationKind(note({}))).toEqual({ icon: 'box', tone: 'ok' });
    expect(notificationKind(note({ type: 'order_cancelled_by_company' }))).toEqual({ icon: 'box', tone: 'bad' });
    expect(notificationKind(note({ type: 'service_request_rejected', serviceRequestId: 's1', orderId: '' })).tone).toBe('bad');
    expect(notificationKind(note({ type: 'report_closed', reportId: 'r1', orderId: '' })).icon).toBe('flag');
    expect(notificationKind(note({ type: 'order_technician_assigned' })).icon).toBe('user');
  });

  it('names the technician assignment', () => {
    expect(notificationTitle(note({ type: 'order_technician_assigned' }))).toBe('أرسلت الشركة فنيًا لطلبك');
  });

  it('splits today from earlier', () => {
    const now = new Date(2026, 10, 18, 12, 0);
    const today = note({ id: 'a' });
    const old = note({ id: 'b', createdAt: new Date(2026, 10, 17, 23, 0) });
    expect(splitByDay([today, old], now)).toEqual({ today: [today], earlier: [old] });
  });

  it('pops up only what arrived after the page read its list', () => {
    const at = new Date(2026, 10, 18, 10, 1).getTime();
    const a = note({ id: 'a' });
    const b = note({ id: 'b' });
    expect(freshArrivals(null, [a], at)).toEqual([]);
    expect(freshArrivals(new Set(['a']), [b, a], at)).toEqual([b]);
    expect(freshArrivals(new Set(['a']), [note({ id: 'c', isRead: true })], at)).toEqual([]);
    expect(freshArrivals(new Set(['a']), [note({ id: 'd', createdAt: new Date(2026, 10, 18, 9, 0) })], at)).toEqual([]);
  });
});
