import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { sendChatMessage } from './chat';
import { mapOrder } from './mappers';
import { sendNotice } from './notify';
import { awaitsRefund, nextStatusLabel, nextStatusOf } from './orderRules';
import { PAYMENT_WINDOW_MS, type CancelReason, type Order, type OrderStatus } from './types';

export type OrderProblem =
  | 'not-awaiting'
  | 'already-confirmed'
  | 'product-gone'
  | 'stock-short'
  | 'no-receipt'
  | 'cancel-not-allowed'
  | 'product-still-covers'
  | 'denied'
  | 'failed';

/** A refusal with a reason the screen can word: nothing was written. */
export class OrderError extends Error {
  constructor(
    readonly problem: OrderProblem,
    readonly detail: { available?: number; requested?: number } = {},
  ) {
    super(problem);
  }
}

export function orderProblemText(error: unknown): string {
  if (!(error instanceof OrderError)) return 'تعذّر تنفيذ العملية، حاول مرة أخرى.';
  const { available, requested } = error.detail;
  switch (error.problem) {
    case 'not-awaiting':
      return 'لم يعد هذا الطلب بانتظار تأكيد الدفع. حدّث الصفحة.';
    case 'already-confirmed':
      return 'تم تأكيد الدفع لهذا الطلب من قبل.';
    case 'product-gone':
      return 'المنتج لم يعد موجودًا في كتالوجك، فلا يمكن تأكيد الطلب. يمكنك إلغاؤه بسبب نفاد المخزون.';
    case 'stock-short':
      return `المخزون لا يغطي الطلب: المتوفر ${available ?? 0} والمطلوب ${requested ?? 0}. زد المخزون ثم أكّد، أو ألغِ الطلب.`;
    case 'no-receipt':
      return 'لا يوجد إيصال محفوظ لهذا الطلب، فلا يمكن تأكيد الدفع.';
    case 'cancel-not-allowed':
      return 'لا يمكن إلغاء هذا الطلب الآن: تغيّرت حالته.';
    case 'product-still-covers':
      return 'المنتج ما زال يغطي هذا الطلب (المتوفر يكفي)، فلا يصح إلغاؤه بسبب نفاد المخزون.';
    case 'denied':
      return 'ليس لديك صلاحية لهذه العملية.';
    default:
      return 'تعذّر تنفيذ العملية، حاول مرة أخرى.';
  }
}

const orders = () => collection(db, 'orders');

/** Confirms the payment and takes the order's stock in ONE transaction (as the app does). */
export async function confirmPayment(orderId: string): Promise<Order> {
  const orderRef = doc(db, 'orders', orderId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      const data = snap.data();
      if (!snap.exists() || !data) throw new OrderError('not-awaiting');
      if (data.paymentStatus === 'confirmed') throw new OrderError('already-confirmed');
      if (data.orderStatus !== 'processing' || data.paymentStatus !== 'pending_verification') {
        throw new OrderError('not-awaiting');
      }
      const order = mapOrder(snap.id, data);
      if (order.stockReserved) {
        // Placed before stock moved to the confirmation: it already took its stock.
        tx.update(orderRef, { paymentStatus: 'confirmed', updatedAt: serverTimestamp() });
        return;
      }
      const productRef = doc(db, 'products', order.productId);
      const productSnap = await tx.get(productRef);
      const product = productSnap.data();
      if (!productSnap.exists() || !product || product.companyId !== order.companyId) {
        throw new OrderError('product-gone');
      }
      const stock = Number.isInteger(product.stockCount) ? (product.stockCount as number) : 0;
      if (stock < order.quantity) {
        throw new OrderError('stock-short', { available: stock, requested: order.quantity });
      }
      tx.update(productRef, {
        stockCount: stock - order.quantity,
        lastOrderId: orderId,
        updatedAt: serverTimestamp(),
      });
      tx.update(orderRef, { paymentStatus: 'confirmed', stockReserved: true, updatedAt: serverTimestamp() });
    });
  } catch (error) {
    if (error instanceof OrderError) throw error;
    if ((error as { code?: string }).code === 'permission-denied') {
      // A missing receipt is the one refusal the transaction cannot see for itself.
      const receipt = await getDoc(doc(db, 'order_receipts', orderId)).catch(() => null);
      if (receipt && !receipt.exists()) throw new OrderError('no-receipt');
      throw new OrderError('denied');
    }
    throw new OrderError('failed');
  }
  return mapOrder(orderId, (await getDoc(orderRef)).data() ?? {});
}

/**
 * Cancels an order that is still Processing, and gives back its stock if it
 * took some, in ONE transaction (so stock can never go back twice).
 */
export async function cancelOrder(orderId: string, reason: CancelReason, note = ''): Promise<void> {
  const cancelNote = note.trim().slice(0, 300);
  const orderRef = doc(db, 'orders', orderId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      const data = snap.data();
      if (!snap.exists() || !data) throw new OrderError('cancel-not-allowed');
      const order = mapOrder(snap.id, data);
      const waiting = data.paymentStatus === 'pending_verification';
      const cancellable =
        data.orderStatus === 'processing' && (waiting || data.paymentStatus === 'confirmed');
      const reasonAllowed = reason === 'company' || waiting;
      if (!cancellable || !reasonAllowed) throw new OrderError('cancel-not-allowed');

      const productRef = doc(db, 'products', order.productId);
      const needsProduct = order.stockReserved || reason === 'out_of_stock';
      const product = needsProduct ? (await tx.get(productRef)).data() : undefined;
      const sameCompany = !!product && product.companyId === order.companyId;
      const stock = product?.stockCount;
      if (reason === 'out_of_stock' && sameCompany && Number.isInteger(stock) && (stock as number) >= order.quantity) {
        throw new OrderError('product-still-covers', { available: stock as number, requested: order.quantity });
      }
      let stockReleased = false;
      if (order.stockReserved && sameCompany && typeof stock === 'number') {
        tx.update(productRef, {
          stockCount: Math.trunc(stock) + order.quantity,
          lastReleasedOrderId: orderId,
          updatedAt: serverTimestamp(),
        });
        stockReleased = true;
      }
      tx.update(orderRef, {
        orderStatus: 'cancelled',
        cancelReason: reason,
        cancelledAt: serverTimestamp(),
        stockReleased,
        ...(cancelNote ? { cancelNote } : {}),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof OrderError) throw error;
    if ((error as { code?: string }).code === 'permission-denied') throw new OrderError('denied');
    throw new OrderError('failed');
  }
}

export { awaitsRefund, nextStatusLabel, nextStatusOf };

/** Moves the order one step and tells the customer. A notice that fails never undoes the step. */
export async function advanceAndNotify(order: Order): Promise<{ notified: boolean }> {
  const next = nextStatusOf(order);
  if (!next) throw new OrderError('cancel-not-allowed');
  await advanceOrder(order, next);
  return { notified: await notifyStatus(order, next) };
}

/**
 * Cancels the order, then tells the technician (if any) and writes [message]
 * into the order's conversation so the customer sees why. There is no
 * notification type for a company cancellation, so the conversation is how the
 * customer hears of it. Both follow-ups are best effort.
 */
export async function cancelWithMessage(
  order: Order,
  reason: CancelReason,
  message: string,
  senderName: string,
  note = '',
): Promise<{ messaged: boolean }> {
  await cancelOrder(order.id, reason, note);
  await notifyCancelledToTechnician(order).catch(() => undefined);
  const messaged = message.trim() ? await sendChatMessage(order.id, message, senderName) : true;
  return { messaged };
}

/** Moves a confirmed order along Processing → Out for Delivery → Completed. */
export async function advanceOrder(order: Order, next: OrderStatus): Promise<void> {
  await updateDoc(doc(db, 'orders', order.id), { orderStatus: next, updatedAt: serverTimestamp() });
}

/** Tells the customer about a status step (the apps word it from the type). Best effort. */
export async function notifyStatus(order: Order, status: OrderStatus): Promise<boolean> {
  const type = status === 'out_for_delivery' ? 'out_for_delivery' : status === 'completed' ? 'order_completed' : null;
  if (!type) return true;
  return sendNotice({
    type,
    recipientType: 'customer',
    recipientId: order.customerId,
    orderId: order.id,
    productName: order.productName,
  });
}

export async function notifyPaymentConfirmed(order: Order): Promise<boolean> {
  const ok = await sendNotice({
    type: 'payment_confirmed',
    recipientType: 'customer',
    recipientId: order.customerId,
    orderId: order.id,
    productName: order.productName,
  });
  // A technician who already has the job learns it can start.
  if (order.technicianId) {
    await sendNotice({
      type: 'job_ready',
      recipientType: 'technician',
      recipientId: order.technicianId,
      orderId: order.id,
      productName: order.productName,
    });
  }
  return ok;
}

export async function notifyCancelledToTechnician(order: Order): Promise<void> {
  if (!order.technicianId) return;
  await sendNotice({
    type: 'job_cancelled',
    recipientType: 'technician',
    recipientId: order.technicianId,
    orderId: order.id,
    productName: order.productName,
  });
}

/** Records, once, that the money of a paid order that was cancelled has been given back (outside the app). */
export async function markRefunded(orderId: string): Promise<void> {
  await updateDoc(doc(db, 'orders', orderId), { refundedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function assignTechnician(order: Order, technicianId: string, technicianName: string): Promise<void> {
  await updateDoc(doc(db, 'orders', order.id), {
    technicianId,
    technicianName,
    updatedAt: serverTimestamp(),
  });
  await sendNotice({
    type: 'technician_assigned',
    recipientType: 'technician',
    recipientId: technicianId,
    orderId: order.id,
    productName: order.productName,
  });
}

/**
 * Cancels as expired the company's orders whose payment was not verified within
 * 24 hours. There is no server for this, so the panel does it when it opens and
 * while it stays open. The phone's clock only picks which orders to try: the
 * rules decide with the server's clock. Never throws.
 */
export async function expireOverdueOrders(companyId: string): Promise<number> {
  let waiting: Order[];
  try {
    const snap = await getDocs(
      query(
        orders(),
        where('companyId', '==', companyId),
        where('orderStatus', '==', 'processing'),
        where('paymentStatus', '==', 'pending_verification'),
      ),
    );
    waiting = snap.docs.map((d) => mapOrder(d.id, d.data()));
  } catch {
    return 0;
  }
  const now = Date.now();
  let expired = 0;
  for (const order of waiting) {
    if (now < order.createdAt.getTime() + PAYMENT_WINDOW_MS) continue;
    try {
      await cancelOrder(order.id, 'expired');
      expired++;
    } catch {
      // Not expired by the server's clock yet, or it changed meanwhile.
    }
  }
  return expired;
}

/** Server-side count of a company's orders matching [filters] (cheap: one read per 1,000). */
export async function countOrders(companyId: string, filters: [string, string][] = []): Promise<number> {
  const q: Query = query(orders(), where('companyId', '==', companyId), ...filters.map(([f, v]) => where(f, '==', v)));
  try {
    return (await getCountFromServer(q)).data().count;
  } catch {
    return 0;
  }
}
