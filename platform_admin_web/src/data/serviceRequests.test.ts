import { describe, expect, it } from 'vitest';
import { en, ar } from '../i18n/dictionary';
import { mapServiceRequest, parseServiceRequestStatus } from './mappers';
import { SERVICE_REQUEST_STATUSES } from './types';

describe('service requests (read-only for Platform Admin)', () => {
  it('maps the document the Flutter app writes', () => {
    const r = mapServiceRequest('r1', {
      customerId: 'u1',
      customerName: 'Amna',
      companyId: 'c1',
      companyName: 'Nile IT',
      serviceId: 's1',
      serviceName: 'Network setup',
      price: 15000,
      details: 'Two offices',
      address: 'Khartoum 2',
      latitude: 15.5,
      longitude: 32.5,
      contactPhone: '0912345678',
      status: 'in_progress',
    });
    expect(r).toMatchObject({
      id: 'r1',
      customerName: 'Amna',
      companyName: 'Nile IT',
      serviceName: 'Network setup',
      price: 15000,
      status: 'in_progress',
      latitude: 15.5,
      longitude: 32.5,
    });
  });

  it('a missing, zero or invalid price is "no price", never 0', () => {
    for (const price of [undefined, null, 0, -5, 'abc', NaN]) {
      expect(mapServiceRequest('r', { price }).price).toBeNull();
    }
  });

  it('unknown statuses read as pending; every status has both translations', () => {
    expect(parseServiceRequestStatus('nonsense')).toBe('pending');
    for (const s of SERVICE_REQUEST_STATUSES) {
      expect(parseServiceRequestStatus(s)).toBe(s);
      expect(en[`serviceRequest.status.${s}`]).toBeTruthy();
      expect(ar[`serviceRequest.status.${s}`]).toBeTruthy();
    }
  });

  it('the dashboard never reads service request conversations', () => {
    // Chats are private to the customer and the company: no admin source file
    // may address the chats collection or its messages.
    const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.*'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    for (const [file, text] of Object.entries(sources)) {
      expect({ file, chats: /['"`]chats['"`/]|['"`]messages['"`]/.test(text) }).toEqual({
        file,
        chats: false,
      });
    }
  });
});
