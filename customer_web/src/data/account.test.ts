import { describe, expect, it } from 'vitest';
import { cleanNational, parsePhone, toE164 } from './phone';
import { SUDAN } from './phoneCountries';
import { notificationBody, notificationTarget, notificationTitle } from './notifications';
import { planReportQuota, ReportLimitReached } from './reports';
import type { AppNotification } from './types';

const notification = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n', type: 'order_completed', productName: '', orderId: '', serviceRequestId: '', reportId: '',
  isRead: false, createdAt: new Date(0), ...over,
});

describe('report quota', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000);

  it('moves through the five slots in turn', () => {
    expect(planReportQuota(0, null, now)).toEqual({ slot: 't0', next: 1 });
    expect(planReportQuota(4, null, now)).toEqual({ slot: 't4', next: 0 });
  });

  it('refuses while the oldest report is under 24 hours old', () => {
    expect(() => planReportQuota(2, hoursAgo(23), now)).toThrow(ReportLimitReached);
    expect(planReportQuota(2, hoursAgo(24), now)).toEqual({ slot: 't2', next: 3 });
  });
});

describe('notifications', () => {
  it('builds its words from the type and name only', () => {
    const n = notification({ type: 'out_for_delivery', productName: 'طابعة' });
    expect(notificationTitle(n)).toBe('طلبك في الطريق إليك');
    expect(notificationBody(n)).toContain('طابعة');
  });

  it('falls back for an unknown type or a missing name', () => {
    expect(notificationTitle(notification({ type: 'made_up' }))).toBe('إشعار');
    expect(notificationBody(notification({ type: 'out_for_delivery' }))).toBe('يوجد تحديث على أحد طلباتك.');
    expect(notificationBody(notification({ type: 'order_completed' }))).toBe('تم إكمال طلبك');
  });

  it('opens what it is about', () => {
    expect(notificationTarget(notification({ reportId: 'r' }))).toBe('/reports');
    expect(notificationTarget(notification({ serviceRequestId: 's' }))).toBe('/requests/s');
    expect(notificationTarget(notification({ orderId: 'o' }))).toBe('/orders/o');
    expect(notificationTarget(notification())).toBeNull();
  });
});

describe('phone', () => {
  it('saves a Sudanese number with its code, without the trunk 0', () => {
    expect(toE164({ country: SUDAN, national: cleanNational('0912345678', SUDAN) })).toBe('+249912345678');
  });

  it('reads a saved number back and leaves an empty one empty', () => {
    expect(parsePhone('+249912345678').national).toBe('912345678');
    expect(toE164(parsePhone(''))).toBe('');
  });
});
