import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { mapOrder } from './mappers';
import { nextStock, type StockMode } from './stock';
import type { OfferBadge, Order, Product, ProductStatus } from './types';

export interface ProductDraft {
  name: string;
  brand: string;
  /** Always the first of imageUrls ('' when there is none), so older apps keep showing a picture. */
  imageUrl: string;
  imageUrls: string[];
  categoryId: string | null;
  price: number | null;
  description: string;
  /** In the order the company wants them shown (see specificationsOrder). */
  specifications: Record<string, string>;
  isDeliveryAvailable: boolean;
  isInstallationAvailable: boolean;
  installationPrice: number | null;
  inStock: boolean;
  status: ProductStatus;
  sku: string;
  lowStockThreshold: number | null;
}

export interface OfferDraft {
  offerPrice: number | null;
  offerEndsAt: Date | null;
  offerBadge: OfferBadge | null;
}

const cleanSpecs = (specs: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(specs)) {
    const key = k.trim();
    const value = v.trim();
    if (key && value) out[key] = value;
  }
  return out;
};

const offerFields = (offer: OfferDraft) => ({
  offerPrice: offer.offerPrice,
  offerEndsAt: offer.offerPrice === null || !offer.offerEndsAt ? null : Timestamp.fromDate(offer.offerEndsAt),
  offerBadge: offer.offerPrice === null ? null : offer.offerBadge,
});

/** A new product, with the exact set of fields the security rules accept. */
export async function createProduct(
  companyId: string,
  companyName: string,
  draft: ProductDraft,
  stockCount: number,
): Promise<string> {
  const ref = doc(collection(db, 'products'));
  await setDoc(ref, {
    id: ref.id,
    companyId,
    companyName,
    name: draft.name.trim(),
    brand: draft.brand.trim(),
    imageUrl: draft.imageUrls[0] ?? '',
    imageUrls: draft.imageUrls,
    categoryId: draft.categoryId,
    price: draft.price,
    currency: 'SDG',
    stockCount,
    inStock: draft.inStock,
    status: draft.status,
    sku: draft.sku.trim(),
    lowStockThreshold: draft.lowStockThreshold,
    description: draft.description.trim(),
    specifications: cleanSpecs(draft.specifications),
    specificationsOrder: Object.keys(cleanSpecs(draft.specifications)),
    isDeliveryAvailable: draft.isDeliveryAvailable,
    isInstallationAvailable: draft.isInstallationAvailable,
    installationPrice: draft.isInstallationAvailable ? draft.installationPrice : null,
    ...offerFields({ offerPrice: null, offerEndsAt: null, offerBadge: null }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Saves ONLY the fields that changed. The whole product is never written back,
 * so a stock change made meanwhile (a payment confirmed while the form was open)
 * can never be overwritten with an old number.
 */
export async function updateProductFields(
  id: string,
  changes: Partial<ProductDraft>,
  options: { clearOffer?: boolean } = {},
): Promise<void> {
  const fields: Record<string, unknown> = {};
  // A price at or below an offer that already ended removes that offer with it.
  if (options.clearOffer) Object.assign(fields, offerFields({ offerPrice: null, offerEndsAt: null, offerBadge: null }));
  if (changes.name !== undefined) fields.name = changes.name.trim();
  if (changes.brand !== undefined) fields.brand = changes.brand.trim();
  if (changes.imageUrls !== undefined) {
    fields.imageUrls = changes.imageUrls;
    fields.imageUrl = changes.imageUrls[0] ?? '';
  } else if (changes.imageUrl !== undefined) {
    fields.imageUrl = changes.imageUrl;
  }
  if (changes.categoryId !== undefined) fields.categoryId = changes.categoryId;
  if (changes.price !== undefined) fields.price = changes.price;
  if (changes.description !== undefined) fields.description = changes.description.trim();
  if (changes.specifications !== undefined) {
    const specs = cleanSpecs(changes.specifications);
    fields.specifications = specs;
    fields.specificationsOrder = Object.keys(specs);
  }
  if (changes.status !== undefined) fields.status = changes.status;
  if (changes.sku !== undefined) fields.sku = changes.sku.trim();
  if (changes.lowStockThreshold !== undefined) fields.lowStockThreshold = changes.lowStockThreshold;
  if (changes.isDeliveryAvailable !== undefined) fields.isDeliveryAvailable = changes.isDeliveryAvailable;
  if (changes.isInstallationAvailable !== undefined) {
    fields.isInstallationAvailable = changes.isInstallationAvailable;
    if (!changes.isInstallationAvailable) fields.installationPrice = null;
  }
  if (changes.installationPrice !== undefined && changes.isInstallationAvailable !== false) {
    fields.installationPrice = changes.installationPrice;
  }
  if (changes.inStock !== undefined) fields.inStock = changes.inStock;
  if (Object.keys(fields).length === 0) return;
  await updateDoc(doc(db, 'products', id), { ...fields, updatedAt: serverTimestamp() });
}

/**
 * Changes the price alone. A running offer must stay below the price (the rules
 * check the same), and an offer that already ended is cleared with it.
 */
export async function setPrice(product: Pick<Product, 'id' | 'offerPrice' | 'offerEndsAt'>, price: number): Promise<void> {
  const offerStillRuns = product.offerPrice !== null && (product.offerEndsAt === null || Date.now() < product.offerEndsAt.getTime());
  if (product.offerPrice !== null && price <= product.offerPrice && offerStillRuns) {
    throw new PriceBelowOffer(product.offerPrice);
  }
  const clearOffer = product.offerPrice !== null && price <= product.offerPrice;
  await updateDoc(doc(db, 'products', product.id), {
    price,
    ...(clearOffer ? { offerPrice: null, offerEndsAt: null, offerBadge: null } : {}),
    updatedAt: serverTimestamp(),
  });
}

export class PriceBelowOffer extends Error {
  constructor(readonly offerPrice: number) {
    super('price-below-offer');
  }
}

/** Puts an offer on a product, or ends it when [offer].offerPrice is null. */
export async function setProductOffer(id: string, offer: OfferDraft): Promise<void> {
  await updateDoc(doc(db, 'products', id), { ...offerFields(offer), updatedAt: serverTimestamp() });
}

export { nextStock };
export type { StockMode };

export class StockError extends Error {
  constructor(readonly problem: 'negative' | 'invalid' | 'gone') {
    super(problem);
  }
}

/**
 * Changes the stock of a product from the number stored right now (inside a
 * transaction), never from the number on screen: a sale confirmed while the
 * dialog was open is not lost.
 */
export async function adjustStock(
  productId: string,
  mode: StockMode,
  amount: number,
): Promise<{ before: number; after: number }> {
  if (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000) throw new StockError('invalid');
  const ref = doc(db, 'products', productId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new StockError('gone');
    const raw = snap.data().stockCount;
    const before = Number.isInteger(raw) ? (raw as number) : 0;
    const after = nextStock(before, mode, amount);
    if (after < 0) throw new StockError('negative');
    tx.update(ref, { stockCount: after, updatedAt: serverTimestamp() });
    return { before, after };
  });
}

/** Open orders (Processing or Out for Delivery) of one product of this company. */
export async function openOrdersOfProduct(companyId: string, productId: string): Promise<Order[]> {
  const snap = await getDocs(
    query(
      collection(db, 'orders'),
      where('companyId', '==', companyId),
      where('productId', '==', productId),
      where('orderStatus', 'in', ['processing', 'out_for_delivery']),
      limit(20),
    ),
  );
  return snap.docs.map((d) => mapOrder(d.id, d.data()));
}

export class ProductHasOpenOrders extends Error {
  constructor(readonly orders: Order[]) {
    super('open-orders');
  }
}

/** Deletes a product, unless orders are still open on it (they could no longer be confirmed). */
export async function deleteProduct(companyId: string, productId: string): Promise<void> {
  const open = await openOrdersOfProduct(companyId, productId);
  if (open.length > 0) throw new ProductHasOpenOrders(open);
  await deleteDoc(doc(db, 'products', productId));
}

/** Moves products to a new visibility (published, draft or archived), each by that one field. */
export async function setProductsStatus(ids: string[], status: ProductStatus): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(ids.map((id) => updateProductFields(id, { status })));
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { ok: results.length - failed, failed };
}

export const productImageFolder =(companyId: string) => `product-images/${companyId}`;

export type { Product };
