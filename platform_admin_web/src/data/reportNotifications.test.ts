import { describe, expect, it } from 'vitest';
import { mapReport } from './mappers';
import { reportNotificationFor } from './reportNotifications';

const report = (extra: Record<string, unknown> = {}) =>
  mapReport('r1', { reporterId: 'u1', reporterRole: 'customer', subject: 'Order never came', status: 'new', ...extra });

describe('telling the sender their report moved on', () => {
  it('tells a customer by their own id, with the report subject and the id the rules fix', () => {
    expect(reportNotificationFor(report(), 'closed')).toEqual({
      id: 'r1_report_closed',
      recipientType: 'customer',
      recipientId: 'u1',
      reportId: 'r1',
      type: 'report_closed',
      productName: 'Order never came',
    });
    expect(reportNotificationFor(report(), 'in_progress')?.id).toBe('r1_report_in_progress');
  });

  it('tells a company through its company id, not the id of the person who wrote it', () => {
    const note = reportNotificationFor(report({ reporterRole: 'company_admin', reporterId: 'adm1', companyId: 'c9' }), 'closed');
    expect(note).toMatchObject({ recipientType: 'company_admin', recipientId: 'c9' });
  });

  it('says nothing when the status did not change, or the report was reopened', () => {
    expect(reportNotificationFor(report({ status: 'closed' }), 'closed')).toBeNull();
    expect(reportNotificationFor(report({ status: 'closed' }), 'new')).toBeNull();
  });

  it('says nothing to someone with no notification list: a technician, or a company with no id', () => {
    expect(reportNotificationFor(report({ reporterRole: 'technician' }), 'closed')).toBeNull();
    expect(reportNotificationFor(report({ reporterRole: 'company_admin', companyId: '' }), 'closed')).toBeNull();
    expect(reportNotificationFor(report({ reporterId: '' }), 'closed')).toBeNull();
  });
});
