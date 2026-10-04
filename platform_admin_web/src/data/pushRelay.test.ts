import { beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({ token: 'id-token' as string | null | Error }));

vi.mock('../firebase', () => ({
  auth: {
    get currentUser() {
      return {
        getIdToken: async () => {
          if (fb.token instanceof Error) throw fb.token;
          return fb.token;
        },
      };
    },
  },
}));

import { PUSH_RELAY_URL, pushToPhone } from './pushRelay';

beforeEach(() => {
  fb.token = 'id-token';
});

describe('asking the relay for a phone push', () => {
  it('posts the notification id with the admin\'s own sign-in', async () => {
    const calls: [string, RequestInit][] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    expect(await pushToPhone('r1_report_closed', fetchImpl)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(`${PUSH_RELAY_URL}/push`);
    expect(calls[0][1].method).toBe('POST');
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer id-token');
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ notificationId: 'r1_report_closed' });
  });

  it('says no, and never throws, when the relay refuses or is down', async () => {
    expect(await pushToPhone('n', (async () => new Response('{}', { status: 422 })) as unknown as typeof fetch)).toBe(false);
    expect(await pushToPhone('n', (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBe(false);
  });

  it('sends nothing when nobody is signed in', async () => {
    fb.token = null;
    const fetchImpl = vi.fn();
    expect(await pushToPhone('n', fetchImpl as unknown as typeof fetch)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    fb.token = new Error('expired');
    expect(await pushToPhone('n', fetchImpl as unknown as typeof fetch)).toBe(false);
  });
});
