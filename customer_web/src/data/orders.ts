import { FirebaseError } from 'firebase/app';
import {
  Bytes,
  doc,
  getDoc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDateTime, isAvailable, salePrice } from './format';
import { mapOrder, mapProduct } from './mappers';
import type { Company, Order, OrderDraft, OrderStatus, PickupPoint, Product, ReceiptImage } from './types';
import { t } from '../i18n';

// Port of the app's order layer (firestore_orders_remote_data_source.dart,
// order_pricing.dart, order_quota.dart). The rules recompute every amount from
// the product, so what is written here has to match them exactly.

/** The flat delivery charge; keep in step with standardDeliveryFee() in firestore.rules. */
export const STANDARD_DELIVERY_FEE = 15000;
export const DELIVERY_ADDRESS_MAX = 500;
export const CUSTOMER_NAME_MAX = 120;
const ORDERS_PER_DAY = 10;
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** A message for the customer: why the order was not placed. */
export class OrderRefused extends Error {}

export const clip = (text: string, max: number): string => text.slice(0, max);

/** The short number orders are shown under. */
export const shortOrderId = (id: string): string => (id.length > 8 ? id.slice(0, 8) : id);

/** About ten characters, as the app makes them; fixed for one checkout, so a retry cannot place it twice. */
export const newOrderId = (): string => (Date.now() * 1000 + Math.floor(Math.random() * 1000)).toString(36);

/** Whether the amounts the customer saw are still what [product] charges now. */
export function matchesProduct(product: Product, unitPrice: number, installationSelected: boolean, installationFee: number): boolean {
  if (salePrice(product) !== unitPrice) return false;
  if (!installationSelected) return installationFee === 0;
  return product.isInstallationAvailable && product.installationPrice !== null && installationFee === product.installationPrice;
}

/** What the company lists to collect from: its points, or its one written address. */
export function effectivePickupPoints(company: Company): PickupPoint[] {
  if (company.pickupPoints.length > 0) return company.pickupPoints;
  const legacy = company.pickupAddress.trim();
  return legacy ? [{ name: '', address: legacy, latitude: null, longitude: null }] : [];
}

export function pickupLabel(point: PickupPoint): string {
  const place = point.address.trim();
  const title = point.name.trim();
  if (title === '') return place;
  return place === '' ? title : `${title} — ${place}`;
}

function quotaNext(quota: DocumentData | undefined): number {
  const next = quota?.next;
  return Number.isInteger(next) && next >= 0 && next < ORDERS_PER_DAY ? next : 0;
}

/**
 * When the next order is allowed, or null when it is allowed now. The quota
 * keeps the times of the last ten orders in slots written in turn; `next` always
 * holds the oldest of them.
 */
export function nextOrderAllowedAt(quota: DocumentData | undefined, now = new Date()): Date | null {
  const stamp = quota?.[`t${quotaNext(quota)}`];
  if (!(stamp instanceof Timestamp)) return null;
  const allowedAt = new Date(stamp.toDate().getTime() + WINDOW_MS);
  return now < allowedAt ? allowedAt : null;
}

export const quotaMessage = (nextAt: Date | null): string =>
  nextAt
    ? t('قدّمت {0} طلبات خلال آخر 24 ساعة، وهذا هو الحد الأقصى. يمكنك الطلب مرة أخرى بعد {1}.', ORDERS_PER_DAY, formatDateTime(nextAt))
    : t('قدّمت {0} طلبات خلال آخر 24 ساعة، وهذا هو الحد الأقصى. يُرجى المحاولة لاحقاً.', ORDERS_PER_DAY);

function checkProduct(product: Product, draft: OrderDraft): void {
  if (product.companyId !== draft.companyId) throw new OrderRefused(t('هذا المنتج لم يعد متاحًا.'));
  if (product.price === null) {
    throw new OrderRefused(t('لا يوجد سعر معلن لـ {0} حتى الآن. يرجى التواصل مع الشركة لطلبه.', draft.productName));
  }
  if (!matchesProduct(product, draft.unitPrice, draft.installationSelected, draft.installationFee)) {
    throw new OrderRefused(t('تغيّر سعر {0} قبل إرسال طلبك، لذلك لم يُسجَّل الطلب. ارجع لمراجعة السعر الجديد، وإذا كنت قد حوّلت المبلغ فيرجى التواصل مع الشركة.', draft.productName));
  }
  const available = isAvailable(product) ? product.stockCount : 0;
  if (available === 0) throw new OrderRefused(t('{0} غير متوفر في المخزون.', draft.productName));
  if (available < draft.quantity) {
    throw new OrderRefused(t('المتوفر من {0} في المخزون {1} فقط. يرجى تقليل الكمية.', draft.productName, available));
  }
}

/** The order at [orderId], when one exists: an answer lost on the way must not place it twice. */
async function storedOrder(orderId: string): Promise<Order | null> {
  try {
    const snap = await getDocFromServer(doc(db, 'orders', orderId));
    return snap.exists() ? mapOrder(snap.id, snap.data()) : null;
  } catch {
    return null;
  }
}

/**
 * Places the order in ONE transaction with its receipt, one step of the quota
 * and its conversation with the company: all of them exist or none does. The
 * order takes no stock. The names stored are the product's own as read here.
 */
export async function placeOrder(draft: OrderDraft, receipt: ReceiptImage): Promise<Order> {
  const orderRef = doc(db, 'orders', draft.id);
  const productRef = doc(db, 'products', draft.productId);
  const quotaRef = doc(db, 'order_quota', draft.customerId);
  try {
    await runTransaction(db, async (tx) => {
      const productSnap = await tx.get(productRef);
      const quotaSnap = await tx.get(quotaRef);
      if (!productSnap.exists()) throw new OrderRefused(t('هذا المنتج لم يعد متاحًا.'));
      const product = mapProduct(productSnap.id, productSnap.data());
      checkProduct(product, draft);

      const quota = quotaSnap.data();
      const nextAt = nextOrderAllowedAt(quota);
      if (nextAt) throw new OrderRefused(quotaMessage(nextAt));

      const productName = product.name;
      const companyName = product.companyName;
      const point = draft.deliveryLatitude !== null && draft.deliveryLongitude !== null
        ? { deliveryLatitude: draft.deliveryLatitude, deliveryLongitude: draft.deliveryLongitude }
        : {};
      tx.set(orderRef, {
        id: draft.id,
        customerId: draft.customerId,
        companyId: draft.companyId,
        companyName,
        productId: draft.productId,
        productName,
        quantity: draft.quantity,
        unitPrice: draft.unitPrice,
        productSubtotal: draft.productSubtotal,
        installationSelected: draft.installationSelected,
        installationFee: draft.installationFee,
        deliveryFee: draft.deliveryFee,
        totalAmount: draft.totalAmount,
        deliveryAddress: draft.deliveryAddress,
        contactPhone: draft.contactPhone,
        deliveryMethod: draft.deliveryMethod,
        ...(draft.deliveryCityId !== null ? { deliveryCityId: draft.deliveryCityId } : {}),
        customerName: draft.customerName,
        paymentStatus: 'pending_verification',
        orderStatus: 'processing',
        receiptFileName: receipt.fileName,
        ...point,
        stockReserved: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.set(doc(db, 'order_receipts', draft.id), {
        orderId: draft.id,
        customerId: draft.customerId,
        companyId: draft.companyId,
        fileName: receipt.fileName,
        contentType: 'image/jpeg',
        image: Bytes.fromUint8Array(receipt.bytes),
        sizeBytes: receipt.bytes.length,
        width: receipt.width,
        height: receipt.height,
        createdAt: serverTimestamp(),
      });
      const next = quotaNext(quota);
      const step = {
        [`t${next}`]: serverTimestamp(),
        next: (next + 1) % ORDERS_PER_DAY,
        lastOrderId: draft.id,
      };
      if (quotaSnap.exists()) tx.update(quotaRef, step);
      else tx.set(quotaRef, step);
      tx.set(doc(db, 'chats', draft.id), {
        id: draft.id,
        serviceRequestId: null,
        orderId: draft.id,
        customerId: draft.customerId,
        companyId: draft.companyId,
        customerName: draft.customerName,
        companyName,
        serviceName: '',
        productName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof OrderRefused) throw error;
    const stored = await storedOrder(draft.id);
    if (stored) return stored;
    const code = error instanceof FirebaseError ? error.code : '';
    if (code === 'permission-denied') {
      const nextAt = await getDoc(quotaRef).then((s) => nextOrderAllowedAt(s.data())).catch(() => null);
      if (nextAt) throw new OrderRefused(quotaMessage(nextAt));
      throw new OrderRefused(t('ليست لديك صلاحية لإرسال هذا الطلب. يرجى تسجيل الدخول مرة أخرى والمحاولة من جديد.'));
    }
    if (code === 'unavailable') throw new OrderRefused(t('تعذر تأكيد الطلب. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.'));
    throw new OrderRefused(t('تعذر إنشاء الطلب. يرجى المحاولة مرة أخرى.'));
  }

  const placed = await getDoc(orderRef);
  const order = mapOrder(draft.id, placed.data() ?? {});
  // A notification that fails to send never undoes the order.
  await notifyCompany(order, 'new_order').catch(() => undefined);
  return order;
}

/** To the order's company; the rules allow exactly this id and these fields. */
export function notifyCompany(order: Pick<Order, 'id' | 'companyId' | 'productName'>, type: 'new_order' | 'new_review'): Promise<void> {
  const id = `${order.id}_${type}`;
  return setDoc(doc(db, 'notifications', id), {
    id,
    recipientType: 'company_admin',
    recipientId: order.companyId,
    orderId: order.id,
    type,
    productName: order.productName,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

/** The stored image of one order, read on demand: every read spends the free quota. */
export async function loadReceipt(orderId: string): Promise<Blob | null> {
  const snap = await getDoc(doc(db, 'order_receipts', orderId));
  const image = snap.data()?.image;
  if (!(image instanceof Bytes)) return null;
  return new Blob([new Uint8Array(image.toUint8Array())], { type: 'image/jpeg' });
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  processing: { label: t('قيد المعالجة'), tone: 'info' },
  out_for_delivery: { label: t('في الطريق للتسليم'), tone: 'warn' },
  completed: { label: t('مكتمل'), tone: 'ok' },
  cancelled: { label: t('ملغى'), tone: 'off' },
};

export const isAwaitingVerification = (o: Order): boolean =>
  o.orderStatus === 'processing' && o.paymentStatus === 'pending_verification';

/** A cancelled order's payment was never verified and never will be. */
export function paymentLabel(o: Order): { label: string; tone: string } {
  if (o.paymentStatus === 'confirmed') return { label: t('مؤكد'), tone: 'ok' };
  return o.orderStatus === 'cancelled'
    ? { label: t('لم يُتحقق منه'), tone: 'off' }
    : { label: t('بانتظار التحقق'), tone: 'warn' };
}

const CANCEL_REASON: Record<string, string> = {
  company: t('ألغته الشركة.'),
  expired: t('أُلغي تلقائياً: لم يُتحقق من الدفع خلال 24 ساعة.'),
  out_of_stock: t('أُلغي لأن المنتج نفد قبل تأكيد الدفع. تعيد الشركة المبلغ المحوّل خارج التطبيق.'),
  admin: t('ألغته المنصة.'),
};

/** What happened to a cancelled order, and how the money comes back. */
export function cancelledLines(o: Order): string[] {
  const lines: string[] = [];
  if (o.cancelReason && CANCEL_REASON[o.cancelReason]) lines.push(CANCEL_REASON[o.cancelReason]);
  if (o.cancelledAt) lines.push(t('أُلغي في {0}', formatDateTime(o.cancelledAt)));
  if (o.paymentStatus === 'confirmed') lines.push(t('كان دفعك قد تأكد: تعيد الشركة إليك المبلغ خارج التطبيق.'));
  else if (o.cancelReason !== 'out_of_stock') lines.push(t('إذا كنت قد حوّلت مبلغاً لهذا الطلب، فستعيده الشركة إليك خارج التطبيق. يمكنك التواصل معها من محادثة الطلب.'));
  return lines;
}
