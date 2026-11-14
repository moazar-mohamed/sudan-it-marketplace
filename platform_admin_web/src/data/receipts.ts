import { doc, getDoc, type DocumentData, type Firestore } from 'firebase/firestore';

/**
 * A payment receipt: the compressed JPEG the customer attached to an order,
 * stored in Firestore as native bytes at `order_receipts/{orderId}`. The
 * security rules let only the order's customer, the owning company's admin and
 * Platform Admin read it (never a technician), and nobody update or delete it.
 * It is read on demand, never with the order list.
 */
export interface OrderReceipt {
  orderId: string;
  fileName: string;
  contentType: string;
  width: number;
  height: number;
  bytes: Uint8Array;
}

/** Null when the order has no stored image (placed before receipts were stored) or the data is unusable. */
export function mapReceipt(orderId: string, data: DocumentData | undefined): OrderReceipt | null {
  if (!data) return null;
  const image = data.image as { toUint8Array?: () => Uint8Array } | undefined;
  if (!image || typeof image.toUint8Array !== 'function') return null;
  const bytes = image.toUint8Array();
  if (bytes.length === 0) return null;
  if (typeof data.width !== 'number' || typeof data.height !== 'number') return null;
  return {
    orderId,
    fileName: typeof data.fileName === 'string' && data.fileName ? data.fileName : 'receipt.jpg',
    contentType: typeof data.contentType === 'string' ? data.contentType : 'image/jpeg',
    width: data.width,
    height: data.height,
    bytes,
  };
}

export async function fetchOrderReceipt(db: Firestore, orderId: string): Promise<OrderReceipt | null> {
  const snap = await getDoc(doc(db, 'order_receipts', orderId));
  return snap.exists() ? mapReceipt(orderId, snap.data()) : null;
}
