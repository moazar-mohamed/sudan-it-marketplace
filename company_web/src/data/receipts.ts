import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';

export type ReceiptState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'error' }
  | { status: 'ready'; url: string; fileName: string };

/**
 * The payment receipt of an order (`order_receipts/{id}`, the image is stored
 * as bytes in the document). Shown from a temporary in-memory URL that is
 * released when the page is left.
 */
export function useReceipt(orderId: string): ReceiptState {
  const [state, setState] = useState<ReceiptState>({ status: 'loading' });
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    setState({ status: 'loading' });
    getDoc(doc(db, 'order_receipts', orderId))
      .then((snap) => {
        if (!live) return;
        const data = snap.data();
        const image = data?.image as { toUint8Array?: () => Uint8Array } | undefined;
        if (!snap.exists() || !data || !image?.toUint8Array) {
          setState({ status: 'none' });
          return;
        }
        const type = typeof data.contentType === 'string' ? data.contentType : 'image/jpeg';
        url = URL.createObjectURL(new Blob([image.toUint8Array() as BlobPart], { type }));
        setState({ status: 'ready', url, fileName: typeof data.fileName === 'string' ? data.fileName : '' });
      })
      .catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [orderId]);
  return state;
}
