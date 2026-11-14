// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ data: undefined as Record<string, unknown> | undefined, path: '' }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  getDoc: async (ref: { path: string }) => {
    store.path = ref.path;
    return { exists: () => store.data !== undefined, data: () => store.data };
  },
}));

const { fetchOrderReceipt, mapReceipt } = await import('./receipts');

const bytes = (n: number) => ({ toUint8Array: () => new Uint8Array(n).fill(3) });

describe('receipts data', () => {
  it('reads order_receipts/{orderId} and maps the stored bytes', async () => {
    store.data = { image: bytes(100), width: 400, height: 800, fileName: 'a.jpg', contentType: 'image/jpeg' };
    const result = await fetchOrderReceipt({} as never, 'o1');
    expect(store.path).toBe('order_receipts/o1');
    expect(result).toMatchObject({ orderId: 'o1', fileName: 'a.jpg', width: 400, height: 800 });
    expect(result!.bytes.length).toBe(100);
  });

  it('a missing document is "no receipt" (an order placed before receipts were stored)', async () => {
    store.data = undefined;
    expect(await fetchOrderReceipt({} as never, 'legacy')).toBeNull();
  });

  it('unusable data is treated as no receipt, never as a crash', () => {
    expect(mapReceipt('o', undefined)).toBeNull();
    expect(mapReceipt('o', { width: 1, height: 1 })).toBeNull(); // no image
    expect(mapReceipt('o', { image: 'AAAA', width: 1, height: 1 })).toBeNull(); // base64 text, not bytes
    expect(mapReceipt('o', { image: bytes(0), width: 1, height: 1 })).toBeNull(); // empty
    expect(mapReceipt('o', { image: bytes(5), width: '1', height: 1 })).toBeNull(); // bad size
  });

  it('fills sensible defaults for optional fields', () => {
    const r = mapReceipt('o', { image: bytes(5), width: 1, height: 1 })!;
    expect(r.fileName).toBe('receipt.jpg');
    expect(r.contentType).toBe('image/jpeg');
  });
});
