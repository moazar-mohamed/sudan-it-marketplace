import { beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({
  writes: [] as { kind: string; path: string; data: Record<string, unknown> }[],
  docs: {} as Record<string, Record<string, unknown> | undefined>,
  commit: vi.fn(),
  push: vi.fn(),
  autoId: 0,
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => {
    if (parts.length === 0) {
      // doc(collectionRef): an automatic id
      return { path: `${String(_db)}/auto${++fb.autoId}`, id: `auto${fb.autoId}` };
    }
    return { path: parts.join('/'), id: parts[parts.length - 1] };
  },
  collection: (_db: unknown, name: string) => name,
  getDoc: async (ref: { path: string }) => ({ exists: () => !!fb.docs[ref.path], data: () => fb.docs[ref.path] }),
  serverTimestamp: () => 'SERVER_TIME',
  increment: (n: number) => ({ increment: n }),
  deleteField: () => 'DELETE',
  setDoc: vi.fn(),
  Timestamp: { fromDate: (d: Date) => d },
  writeBatch: () => ({
    update: (ref: { path: string }, data: Record<string, unknown>) => fb.writes.push({ kind: 'update', path: ref.path, data }),
    set: (ref: { path: string }, data: Record<string, unknown>) => fb.writes.push({ kind: 'set', path: ref.path, data }),
    commit: fb.commit,
  }),
}));
vi.mock('../firebase', () => ({ auth: { currentUser: { uid: 'admin1' } }, db: {}, firebaseConfig: {} }));
vi.mock('./auditLog', () => ({
  stageAudit: (_batch: unknown, entry: Record<string, unknown>) => fb.writes.push({ kind: 'audit', path: 'admin_audit_log', data: entry }),
  recordAudit: vi.fn(),
}));
vi.mock('./pushRelay', () => ({ pushToPhone: fb.push, pushCityAnnouncement: vi.fn() }));

import { cancelOrderAsAdmin, setProductHidden } from './actions';
import { orderCancelledNotices, productHiddenNotice } from './adminNotices';

beforeEach(() => {
  fb.writes.length = 0;
  fb.autoId = 0;
  fb.commit.mockReset().mockResolvedValue(undefined);
  fb.push.mockReset().mockResolvedValue(true);
  fb.docs = {
    'orders/o1': {
      orderStatus: 'processing',
      customerId: 'cust1',
      companyId: 'c1',
      productId: 'p1',
      productName: 'Router',
      quantity: 2,
      stockReserved: true,
    },
    'products/p1': { companyId: 'c1', name: 'Router' },
  };
});

describe('the notices an admin action writes', () => {
  it('an order cancelled by the admin has one for its customer and one for its company', () => {
    const notices = orderCancelledNotices({ id: 'o1', customerId: 'cust1', companyId: 'c1', productName: 'Router' });
    expect(notices.map((n) => [n.id, n.recipientType, n.recipientId, n.type])).toEqual([
      ['o1_order_cancelled_by_admin', 'customer', 'cust1', 'order_cancelled_by_admin'],
      ['o1_order_cancelled_by_admin_company', 'company_admin', 'c1', 'order_cancelled_by_admin_company'],
    ]);
  });

  it('leaves out a recipient that is unknown', () => {
    expect(orderCancelledNotices({ id: 'o1', customerId: '', companyId: 'c1', productName: 'Router' })).toHaveLength(1);
  });

  it('a hidden or shown product has one for its company, none without a company', () => {
    expect(productHiddenNotice({ id: 'p1', name: 'Router', companyId: 'c1' }, true)).toMatchObject({
      recipientId: 'c1',
      type: 'product_hidden',
      productName: 'Router',
    });
    expect(productHiddenNotice({ id: 'p1', name: 'Router', companyId: 'c1' }, false)?.type).toBe('product_shown');
    expect(productHiddenNotice({ id: 'p1', name: 'Router', companyId: '' }, true)).toBeNull();
  });
});

describe('cancelling an order as the admin', () => {
  it('writes the cancellation, the stock, the activity entry and both notices in one batch, then pushes both', async () => {
    await cancelOrderAsAdmin('o1', ' Stuck ');
    expect(fb.writes.map((w) => [w.kind, w.path])).toEqual([
      ['update', 'products/p1'],
      ['update', 'orders/o1'],
      ['audit', 'admin_audit_log'],
      ['set', 'notifications/o1_order_cancelled_by_admin'],
      ['set', 'notifications/o1_order_cancelled_by_admin_company'],
    ]);
    expect(fb.writes[3].data).toEqual({
      id: 'o1_order_cancelled_by_admin',
      recipientType: 'customer',
      recipientId: 'cust1',
      orderId: 'o1',
      type: 'order_cancelled_by_admin',
      productName: 'Router',
      isRead: false,
      createdAt: 'SERVER_TIME',
      senderId: 'admin1',
    });
    expect(fb.push.mock.calls.map((c) => c[0])).toEqual([
      'o1_order_cancelled_by_admin',
      'o1_order_cancelled_by_admin_company',
    ]);
  });

  it('pushes nothing when the batch is refused', async () => {
    fb.commit.mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    await expect(cancelOrderAsAdmin('o1', 'r')).rejects.toMatchObject({ code: 'permission-denied' });
    expect(fb.push).not.toHaveBeenCalled();
  });

  it('a push that fails never undoes the cancellation', async () => {
    fb.push.mockRejectedValue(new Error('relay down'));
    await expect(cancelOrderAsAdmin('o1', 'r')).resolves.toBeUndefined();
  });
});

describe('hiding a product as the admin', () => {
  it('tells its company in the same batch and pushes it', async () => {
    await setProductHidden({ id: 'p1', name: 'Router', companyId: 'c1' }, true, 'Counterfeit item');
    expect(fb.writes.map((w) => [w.kind, w.path])).toEqual([
      ['update', 'products/p1'],
      ['audit', 'admin_audit_log'],
      ['set', 'notifications/auto1'],
    ]);
    expect(fb.writes[2].data).toEqual({
      id: 'auto1',
      recipientType: 'company_admin',
      recipientId: 'c1',
      productId: 'p1',
      type: 'product_hidden',
      productName: 'Router',
      isRead: false,
      createdAt: 'SERVER_TIME',
      senderId: 'admin1',
    });
    expect(fb.push).toHaveBeenCalledWith('auto1');
  });

  it('says it is shown again when it is', async () => {
    await setProductHidden({ id: 'p1', name: 'Router', companyId: 'c1' }, false);
    expect(fb.writes[2].data.type).toBe('product_shown');
  });

  it('still saves when the company is not known (no notice, no push)', async () => {
    await setProductHidden({ id: 'p1', name: 'Router' }, true, 'x');
    expect(fb.writes.map((w) => w.kind)).toEqual(['update', 'audit']);
    expect(fb.push).not.toHaveBeenCalled();
  });
});
