import { describe, expect, it, vi } from 'vitest';
import type { WriteBatch } from 'firebase/firestore';
import { MAX_BATCH_WRITES, MAX_RULE_LOOKUPS, commitWithRetry, packBatches } from './categoryOps';

const item = (n: number, lookups: string[] = []) => ({ n, lookups });

describe('packing writes into batches', () => {
  it('keeps every item, in order', () => {
    const items = Array.from({ length: 1000 }, (_, i) => item(i));
    const batches = packBatches(items);
    expect(batches.flat().map((i) => i.n)).toEqual(items.map((i) => i.n));
  });

  it('never puts more than the write limit in one batch', () => {
    const batches = packBatches(Array.from({ length: 1234 }, (_, i) => item(i)));
    expect(batches.every((b) => b.length <= MAX_BATCH_WRITES)).toBe(true);
    expect(batches).toHaveLength(Math.ceil(1234 / MAX_BATCH_WRITES));
    expect(MAX_BATCH_WRITES).toBeLessThanOrEqual(500); // Firestore's own limit
  });

  it('never needs more distinct rule lookups than the limit in one batch', () => {
    const items = Array.from({ length: 200 }, (_, i) => item(i, [`categories/c${i % 50}`, 'companies/x']));
    const batches = packBatches(items);
    for (const batch of batches) {
      const keys = new Set(batch.flatMap((i) => i.lookups));
      expect(keys.size).toBeLessThanOrEqual(MAX_RULE_LOOKUPS);
    }
    expect(batches.length).toBeGreaterThan(1);
    // The rules allow 20 lookups per request and the user profile takes two.
    expect(MAX_RULE_LOOKUPS).toBeLessThanOrEqual(18);
  });

  it('items that share a lookup share a batch, however many there are', () => {
    const batches = packBatches(Array.from({ length: 300 }, (_, i) => item(i, ['categories/one'])));
    expect(batches).toHaveLength(1);
  });

  it('an item with more lookups than a batch can hold is an error, not a silent skip', () => {
    expect(() => packBatches([item(1, Array.from({ length: 20 }, (_, i) => `k${i}`))])).toThrow(/lookups/);
  });

  it('nothing to write means no batch', () => {
    expect(packBatches([])).toEqual([]);
  });
});

describe('committing with retries', () => {
  const batchFailing = (...codes: (string | null)[]) => {
    const commit = vi.fn();
    for (const code of codes) {
      if (code === null) commit.mockResolvedValueOnce(undefined);
      else commit.mockRejectedValueOnce(Object.assign(new Error(code), { code }));
    }
    return { batch: { commit } as unknown as WriteBatch, commit };
  };

  it('retries a network failure with a growing delay, then succeeds', async () => {
    const { batch, commit } = batchFailing('unavailable', 'deadline-exceeded', null);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await commitWithRetry(batch, { sleep });
    expect(commit).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000]);
  });

  it('gives up after the last attempt and reports the error', async () => {
    const { batch, commit } = batchFailing('unavailable', 'unavailable', 'unavailable');
    await expect(commitWithRetry(batch, { attempts: 3, sleep: async () => {} })).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(commit).toHaveBeenCalledTimes(3);
  });

  it('never retries a refusal by the security rules or a missing document', async () => {
    for (const code of ['permission-denied', 'not-found', 'invalid-argument', 'failed-precondition']) {
      const { batch, commit } = batchFailing(code);
      const sleep = vi.fn();
      await expect(commitWithRetry(batch, { sleep })).rejects.toMatchObject({ code });
      expect(commit).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    }
  });
});
