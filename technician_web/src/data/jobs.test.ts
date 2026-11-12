import { describe, expect, it } from 'vitest';
import { evaluateAccess } from '../auth/AuthProvider';
import {
  actionOf,
  chatUnread,
  directionsUrl,
  distanceKm,
  formatKm,
  isOpenJob,
  monthFees,
  nextJob,
  nextStatus,
  phoneForms,
  searchJobs,
  shortId,
} from './jobs';
import type { Job } from './types';

const base: Job = {
  id: 'ORDER12345XYZ',
  orderStatus: 'processing',
  paymentStatus: 'confirmed',
  deliveryMethod: 'delivery',
  deliveryAddress: 'الخرطوم، الرياض، شارع المشتل',
  deliveryLatitude: 15.6,
  deliveryLongitude: 32.55,
  productName: 'طابعة HP LaserJet',
  quantity: 1,
  installationFee: 7500,
  customerId: 'c1',
  customerName: 'أحمد عثمان',
  contactPhone: '+249912345678',
  companyId: 'co1',
  companyName: 'Print Hub',
  technicianId: 't1',
  technicianName: 'محمد',
  createdAt: new Date('2026-11-10T10:00:00'),
  updatedAt: null,
  cancelNote: '',
  cancelledAt: null,
  pendingSync: false,
};
const job = (over: Partial<Job>): Job => ({ ...base, ...over });

const WORDS = { processing: 'قيد التجهيز', out_for_delivery: 'في الطريق', completed: 'مكتملة', cancelled: 'ملغاة', waiting: 'بانتظار الدفع' };

describe('status steps (TechnicianFormat.nextStatus)', () => {
  it('delivery: processing → out for delivery → completed', () => {
    expect(nextStatus(base)).toBe('out_for_delivery');
    expect(nextStatus(job({ orderStatus: 'out_for_delivery' }))).toBe('completed');
  });
  it('pickup completes straight from processing', () => {
    expect(nextStatus(job({ deliveryMethod: 'pickup' }))).toBe('completed');
  });
  it('completed and cancelled are final', () => {
    expect(nextStatus(job({ orderStatus: 'completed' }))).toBeNull();
    expect(nextStatus(job({ orderStatus: 'cancelled' }))).toBeNull();
  });
});

describe('the main button', () => {
  it('nothing moves before the payment is confirmed', () => {
    expect(actionOf(job({ paymentStatus: 'pending_verification' }))).toBe('waiting');
  });
  it('start, then finish; pickup goes to finish', () => {
    expect(actionOf(base)).toBe('start');
    expect(actionOf(job({ orderStatus: 'out_for_delivery' }))).toBe('finish');
    expect(actionOf(job({ deliveryMethod: 'pickup' }))).toBe('finish');
  });
  it('done and cancelled have no button', () => {
    expect(actionOf(job({ orderStatus: 'completed' }))).toBe('done');
    expect(actionOf(job({ orderStatus: 'cancelled', paymentStatus: 'pending_verification' }))).toBe('cancelled');
  });
});

describe('next job (technician_job_helpers.nextJob)', () => {
  const here = { latitude: 15.6, longitude: 32.5 };
  it('paid first, then nearest, then oldest', () => {
    const unpaidNear = job({ id: 'a', paymentStatus: 'pending_verification', deliveryLongitude: 32.5 });
    const paidFar = job({ id: 'b', deliveryLongitude: 32.9 });
    const paidNear = job({ id: 'c', deliveryLongitude: 32.52 });
    expect(nextJob([unpaidNear, paidFar, paidNear], here)?.id).toBe('c');
    expect(nextJob([unpaidNear, paidFar], here)?.id).toBe('b');
  });
  it('without a position, the oldest', () => {
    const newer = job({ id: 'n', createdAt: new Date('2026-11-11') });
    const older = job({ id: 'o', createdAt: new Date('2026-11-01') });
    expect(nextJob([newer, older], null)?.id).toBe('o');
  });
  it('skips completed and cancelled', () => {
    expect(nextJob([job({ orderStatus: 'completed' }), job({ orderStatus: 'cancelled' })], null)).toBeNull();
    expect(isOpenJob(job({ orderStatus: 'out_for_delivery' }))).toBe(true);
  });
});

describe('month fees', () => {
  const now = new Date('2026-11-12T12:00:00');
  it('adds completed jobs of this month, by updatedAt (else createdAt)', () => {
    const jobs = [
      job({ orderStatus: 'completed', installationFee: 7500, updatedAt: new Date('2026-11-05') }),
      job({ orderStatus: 'completed', installationFee: 10000, updatedAt: null, createdAt: new Date('2026-11-02') }),
      job({ orderStatus: 'completed', installationFee: 999, updatedAt: new Date('2026-10-30') }),
      job({ orderStatus: 'out_for_delivery', installationFee: 5000 }),
    ];
    expect(monthFees(jobs, now)).toBe(17500);
  });
});

describe('distance', () => {
  it('one decimal under 10 km, rounded above', () => {
    expect(formatKm(3.24)).toBe('3.2');
    expect(formatKm(11.4)).toBe('11');
  });
  it('is about right', () => {
    const km = distanceKm({ latitude: 15.5007, longitude: 32.5599 }, { latitude: 15.6445, longitude: 32.4777 });
    expect(km).toBeGreaterThan(17);
    expect(km).toBeLessThan(19);
  });
});

describe('directions', () => {
  it('coordinates first, else the written address, none for pickup', () => {
    expect(directionsUrl(base)).toContain('destination=15.6,32.55');
    expect(directionsUrl(job({ deliveryLatitude: null, deliveryLongitude: null }))).toContain('query=');
    expect(directionsUrl(job({ deliveryMethod: 'pickup' }))).toBeNull();
  });
});

describe('search', () => {
  const jobs = [base, job({ id: 'ZZZ99999', productName: 'راوتر TP-Link', customerName: 'سارة', contactPhone: '0911000222' })];
  it('finds a phone in any form and the short job number', () => {
    expect(searchJobs(jobs, '0912345678', WORDS).jobs.map((j) => j.id)).toEqual([base.id]);
    expect(searchJobs(jobs, '249911000222', WORDS).jobs.map((j) => j.id)).toEqual(['ZZZ99999']);
    expect(searchJobs(jobs, shortId(base.id), WORDS).jobs[0].id).toBe(base.id);
  });
  it('finds by product and status words, and suggests on a typo', () => {
    expect(searchJobs(jobs, 'راوتر', WORDS).jobs).toHaveLength(1);
    expect(searchJobs(jobs, 'التجهيز', WORDS).jobs).toHaveLength(2);
    const miss = searchJobs(jobs, 'طابعه', WORDS);
    expect(miss.jobs.length + (miss.suggestion ? 1 : 0)).toBeGreaterThan(0);
  });
  it('phone forms', () => {
    expect(phoneForms('+249 91 234 5678')).toContain('0912345678');
  });
});

describe('chat unread', () => {
  const at = new Date('2026-11-12T10:00:00');
  it('only when the company wrote last and the technician has not read since', () => {
    expect(chatUnread({ id: 'x', lastMessageText: 'hi', lastMessageAt: at, lastMessageSenderRole: 'company', technicianLastReadAt: null })).toBe(true);
    expect(chatUnread({ id: 'x', lastMessageText: 'hi', lastMessageAt: at, lastMessageSenderRole: 'technician', technicianLastReadAt: null })).toBe(false);
    expect(chatUnread({ id: 'x', lastMessageText: 'hi', lastMessageAt: at, lastMessageSenderRole: 'company', technicianLastReadAt: new Date('2026-11-12T11:00:00') })).toBe(false);
    expect(chatUnread(null)).toBe(false);
  });
});

describe('who gets in', () => {
  it('technicians with a company only', () => {
    expect(evaluateAccess('u', { role: 'technician', companyId: 'co1', mustChangePassword: true }).ok).toBe(true);
    expect(evaluateAccess('u', { role: 'company_admin', companyId: 'co1' })).toEqual({ ok: false, reason: 'not_technician' });
    expect(evaluateAccess('u', { role: 'customer' })).toEqual({ ok: false, reason: 'not_technician' });
    expect(evaluateAccess('u', { role: 'technician', companyId: '' })).toEqual({ ok: false, reason: 'not_technician' });
    expect(evaluateAccess('u', undefined)).toEqual({ ok: false, reason: 'not_found' });
  });
});
