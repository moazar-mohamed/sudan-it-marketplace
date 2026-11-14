import { beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({
  writes: [] as { kind: string; path: string; data: Record<string, unknown> }[],
  existing: new Set<string>(),
  getDocFails: false,
  commit: vi.fn(),
  push: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  collection: (_db: unknown, name: string) => ({ path: name }),
  getDoc: async (ref: { path: string }) => {
    if (fb.getDocFails) throw new Error('offline');
    return { exists: () => fb.existing.has(ref.path) };
  },
  serverTimestamp: () => 'SERVER_TIME',
  increment: (n: number) => n,
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
vi.mock('./pushRelay', () => ({ pushToPhone: fb.push }));

import { setReportStatus } from './actions';
import { mapReport } from './mappers';

const report = (extra: Record<string, unknown> = {}) =>
  mapReport('r1', { reporterId: 'u1', reporterRole: 'customer', subject: 'Order never came', status: 'new', ...extra });

beforeEach(() => {
  fb.writes.length = 0;
  fb.existing.clear();
  fb.getDocFails = false;
  fb.commit.mockReset().mockResolvedValue(undefined);
  fb.push.mockReset().mockResolvedValue(true);
});

describe('moving a report along', () => {
  it('changes only the status, the reply and the time, records it, and tells the sender in the same batch', async () => {
    await setReportStatus(report(), 'closed', '  Refunded.  ');
    expect(fb.writes.map((w) => [w.kind, w.path])).toEqual([
      ['update', 'reports/r1'],
      ['audit', 'admin_audit_log'],
      ['set', 'notifications/r1_report_closed'],
    ]);
    expect(fb.writes[0].data).toEqual({ status: 'closed', resolution: 'Refunded.', updatedAt: 'SERVER_TIME' });
    expect(fb.writes[2].data).toEqual({
      id: 'r1_report_closed',
      recipientType: 'customer',
      recipientId: 'u1',
      reportId: 'r1',
      type: 'report_closed',
      productName: 'Order never came',
      isRead: false,
      createdAt: 'SERVER_TIME',
      senderId: 'admin1',
    });
  });

  it('asks for the phone push only after the batch was saved', async () => {
    let order = '';
    fb.commit.mockImplementation(async () => {
      order += 'commit,';
    });
    fb.push.mockImplementation(async () => {
      order += 'push';
      return true;
    });
    await setReportStatus(report(), 'closed', '');
    expect(order).toBe('commit,push');
    expect(fb.push).toHaveBeenCalledWith('r1_report_closed');
  });

  it('does not tell them twice about a status reached before (a reopened report), but still saves the change', async () => {
    fb.existing.add('notifications/r1_report_closed');
    await setReportStatus(report({ status: 'new' }), 'closed', 'Again');
    expect(fb.writes.some((w) => w.path.startsWith('notifications/'))).toBe(false);
    expect(fb.commit).toHaveBeenCalledTimes(1);
    expect(fb.push).not.toHaveBeenCalled();
  });

  it('saves the change without a notice when it could not check for an earlier one', async () => {
    fb.getDocFails = true;
    await setReportStatus(report(), 'closed', '');
    expect(fb.writes.some((w) => w.path.startsWith('notifications/'))).toBe(false);
    expect(fb.commit).toHaveBeenCalledTimes(1);
  });

  it('only a reply with the same status tells nobody', async () => {
    await setReportStatus(report({ status: 'closed' }), 'closed', 'New wording');
    expect(fb.writes.map((w) => w.kind)).toEqual(['update', 'audit']);
    expect(fb.push).not.toHaveBeenCalled();
  });

  it('a push that fails never undoes the change', async () => {
    fb.push.mockRejectedValue(new Error('relay down'));
    await expect(setReportStatus(report(), 'in_progress', '')).resolves.toBeUndefined();
  });

  it('nothing is pushed when the batch is refused', async () => {
    fb.commit.mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    await expect(setReportStatus(report(), 'closed', '')).rejects.toMatchObject({ code: 'permission-denied' });
    expect(fb.push).not.toHaveBeenCalled();
  });
});
