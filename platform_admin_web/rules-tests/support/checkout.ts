/*
 * How the app places an order and how a company confirms its payment, shared
 * by the order rules tests so that every file writes them the same way.
 *
 * Stock is taken when the company confirms the payment, never when the
 * customer orders:
 *  - placeOrder: ONE transaction by the customer. It reads their order quota,
 *    then writes the order (stockReserved false), its receipt, the quota's
 *    next slot and, when asked, the order's conversation. The product is
 *    never written.
 *  - confirmPayment: ONE transaction by the company. It reads the order and
 *    its product, checks that the product still covers the order, then lowers
 *    the stock by the order's quantity and confirms the payment. An order
 *    placed before stock moved to the confirmation (stockReserved true, or no
 *    stockReserved field at all) already took its stock and is confirmed
 *    without taking more. Only an explicit false means "not taken yet".
 */
import {
  Bytes,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Timestamp,
  type Transaction,
} from 'firebase/firestore';

type Data = Record<string, unknown>;

/** How many orders a customer may place in any 24 hours (order_quota in firestore.rules). */
export const ORDERS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The app refuses before writing: the product no longer covers the order. */
export class OutOfStock extends Error {}

/** The app refuses before writing: five orders in the last 24 hours. */
export class QuotaReached extends Error {}

/**
 * A small valid receipt for [order], named as the order names it (an order
 * that names none still gets a correctly named receipt, so that only the
 * order's own missing name is wrong).
 */
export function receiptFor(order: Data, extra: Data = {}): Data {
  return {
    orderId: order.id,
    customerId: order.customerId,
    companyId: order.companyId,
    fileName: order.receiptFileName ?? 'receipt.jpg',
    contentType: 'image/jpeg',
    image: Bytes.fromUint8Array(new Uint8Array(1000).fill(7)),
    sizeBytes: 1000,
    width: 1080,
    height: 1920,
    createdAt: serverTimestamp(),
    ...extra,
  };
}

/** The order conversation the app writes with a new order. */
export function chatFor(order: Data, extra: Data = {}): Data {
  return {
    id: order.id,
    orderId: order.id,
    customerId: order.customerId,
    companyId: order.companyId,
    customerName: order.customerName,
    companyName: order.companyName,
    productName: order.productName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

export interface PlaceOptions {
  /** The receipt document written with the order; null writes none. Default: receiptFor(order). */
  receipt?: Data | null;
  /** Also write the order's conversation, as the app does. */
  chat?: boolean;
  /** false: write no quota step at all. */
  quota?: boolean;
  /** Fields added to (or overriding) the quota step. */
  quotaExtra?: Data;
  /** Other writes sent in the same transaction (the old checkout's stock write, ...). */
  also?: (tx: Transaction, db: Firestore) => void;
  /** Send the writes even when the app would refuse (the quota is full). */
  skipAppChecks?: boolean;
  maxAttempts?: number;
}

/**
 * The app's checkout transaction for [order], sent by the signed-in user of
 * [db] (the order's customer unless a test says otherwise).
 */
export function placeOrder(db: Firestore, uid: string, order: Data, options: PlaceOptions = {}) {
  const orderId = order.id as string;
  const quotaRef = doc(db, 'order_quota', uid);
  return runTransaction(
    db,
    async (tx) => {
      const quota = options.quota === false ? undefined : await tx.get(quotaRef);
      let step: Data | undefined;
      if (quota && !quota.exists()) {
        step = { t0: serverTimestamp(), next: 1, lastOrderId: orderId };
      } else if (quota) {
        const next = quota.data().next as number;
        const oldest = quota.data()[`t${next}`] as Timestamp | undefined;
        if (!options.skipAppChecks && oldest && Date.now() < oldest.toMillis() + DAY_MS) {
          throw new QuotaReached(`${ORDERS_PER_DAY} orders in the last 24 hours`);
        }
        step = { [`t${next}`]: serverTimestamp(), next: (next + 1) % ORDERS_PER_DAY, lastOrderId: orderId };
      }
      tx.set(doc(db, 'orders', orderId), order);
      const receipt = options.receipt === undefined ? receiptFor(order) : options.receipt;
      if (receipt) {
        tx.set(doc(db, 'order_receipts', orderId), receipt);
      }
      if (step) {
        const write = { ...step, ...options.quotaExtra };
        if (quota!.exists()) {
          tx.update(quotaRef, write);
        } else {
          tx.set(quotaRef, write);
        }
      }
      if (options.chat) {
        tx.set(doc(db, 'chats', orderId), chatFor(order));
      }
      options.also?.(tx, db);
    },
    { maxAttempts: options.maxAttempts ?? 5 },
  );
}

export interface ConfirmOptions {
  /** Send the writes even when the app would refuse (the product no longer covers the order). */
  skipAppChecks?: boolean;
  /** Take the stock of this product instead of the order's own. */
  productId?: string;
  /** Take this many units instead of the order's quantity. */
  take?: number;
  /** Write the order alone, taking no stock. */
  noStock?: boolean;
  /** Fields added to the order write. */
  extra?: Data;
  maxAttempts?: number;
}

/** The app's payment confirmation transaction, sent by the signed-in company admin of [db]. */
export function confirmPayment(db: Firestore, orderId: string, options: ConfirmOptions = {}) {
  return runTransaction(
    db,
    async (tx) => {
      const orderRef = doc(db, 'orders', orderId);
      const order = (await tx.get(orderRef)).data();
      if (!order) {
        throw new Error(`no order ${orderId}`);
      }
      const productRef = doc(db, 'products', options.productId ?? (order.productId as string));
      const product = await tx.get(productRef);
      // As the app (OrderModel): a missing field means the stock was taken.
      const alreadyTaken = order.stockReserved !== false;
      if (!alreadyTaken && !options.noStock) {
        const available = product.data()?.stockCount;
        const covers =
          product.exists() &&
          product.data()!.companyId === order.companyId &&
          typeof available === 'number' &&
          available >= (order.quantity as number);
        if (!covers && !options.skipAppChecks) {
          throw new OutOfStock(`only ${String(available)} left, the order needs ${String(order.quantity)}`);
        }
        // A product that is gone cannot be written at all: the order is sent alone.
        if (product.exists()) {
          tx.update(productRef, {
            stockCount: (available as number) - (options.take ?? (order.quantity as number)),
            lastOrderId: orderId,
            updatedAt: serverTimestamp(),
          });
        }
      }
      tx.update(orderRef, {
        paymentStatus: 'confirmed',
        ...(alreadyTaken ? {} : { stockReserved: true }),
        updatedAt: serverTimestamp(),
        ...options.extra,
      });
    },
    { maxAttempts: options.maxAttempts ?? 5 },
  );
}

/**
 * confirmPayment with the app's handling of a race: when another
 * confirmation takes the stock first, the rules refuse this commit against
 * the newer stock. The company's app then tries again with fresh reads,
 * which ends in OutOfStock when the stock no longer covers the order, or
 * stops when the order is no longer waiting for its confirmation.
 */
export async function confirmPaymentAsTheApp(db: Firestore, orderId: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await confirmPayment(db, orderId, { maxAttempts: 30 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (error instanceof OutOfStock || (code !== 'permission-denied' && code !== 'aborted') || attempt >= 4) {
        throw error;
      }
      const order = (await getDoc(doc(db, 'orders', orderId))).data();
      if (order?.paymentStatus !== 'pending_verification' || order.orderStatus !== 'processing') {
        throw error;
      }
    }
  }
}

/**
 * The confirmation's two writes WITHOUT reading anything first, so only the
 * update rules on the order and the product can refuse them.
 */
export function confirmPaymentBlind(db: Firestore, orderId: string, productId: string, stockAfter: number) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'products', productId), {
    stockCount: stockAfter,
    lastOrderId: orderId,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'orders', orderId), {
    paymentStatus: 'confirmed',
    stockReserved: true,
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}
