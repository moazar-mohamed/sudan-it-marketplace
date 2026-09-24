import { describe, expect, it } from 'vitest';
import {
  COMPANY_TONE,
  ORDER_TONE,
  PAYMENT_TONE,
  SERVICE_REQUEST_TONE,
} from './StatusBadges';

// The same status reads with the same colour family as in the mobile app.
describe('status tones', () => {
  it('orders: processing is info, out for delivery is progress, completed is success', () => {
    expect(ORDER_TONE).toEqual({
      processing: 'info',
      out_for_delivery: 'progress',
      completed: 'success',
    });
  });

  it('service requests: cancelled is neutral (withdrawn), rejected is danger', () => {
    expect(SERVICE_REQUEST_TONE.cancelled).toBe('neutral');
    expect(SERVICE_REQUEST_TONE.rejected).toBe('danger');
    expect(SERVICE_REQUEST_TONE.in_progress).toBe('progress');
    expect(SERVICE_REQUEST_TONE.pending).toBe('warning');
  });

  it('payments and companies', () => {
    expect(PAYMENT_TONE.pending_verification).toBe('warning');
    expect(PAYMENT_TONE.confirmed).toBe('success');
    expect(COMPANY_TONE.active).toBe('success');
    expect(COMPANY_TONE.inactive).toBe('neutral');
  });
});
