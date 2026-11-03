import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { awaitsRefund, expireOverdueOrders } from './orders';
import { mapCategory, mapCompany, mapOrder, mapProduct } from './mappers';
import type { Category, Company, Order, Product } from './types';

interface CompanyDataValue {
  companyId: string;
  company: Company | null;
  /** All of the company's products; null while they load. */
  products: Product[] | null;
  /** Orders still Processing or Out for Delivery; null while they load. */
  openOrders: Order[] | null;
  /** Orders waiting for the payment to be verified (a subset of openOrders). */
  pendingPayment: Order[];
  /** Paid orders that were cancelled and whose refund has not been recorded yet. */
  pendingRefunds: Order[];
  categories: Category[];
  /** A live read failed (offline, or access refused). */
  failed: boolean;
}

const Ctx = createContext<CompanyDataValue | null>(null);

const byNewest = (a: { createdAt: Date | null }, b: { createdAt: Date | null }) =>
  (b.createdAt?.getTime() ?? Infinity) - (a.createdAt?.getTime() ?? Infinity);

/**
 * The few things every page needs, kept live from one set of listeners: the
 * company, its products, and the orders still open. Pages that need more (the
 * full order history, technicians, reviews...) read it themselves.
 */
export function CompanyDataProvider({ companyId, children }: { companyId: string; children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [openOrders, setOpenOrders] = useState<Order[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cancelledPaid, setCancelledPaid] = useState<Order[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fail = () => setFailed(true);
    const ok = () => setFailed(false);
    const unsubs = [
      onSnapshot(doc(db, 'companies', companyId), (s) => { ok(); setCompany(s.exists() ? mapCompany(s.id, s.data()) : null); }, fail),
      onSnapshot(
        query(collection(db, 'products'), where('companyId', '==', companyId)),
        (s) => { ok(); setProducts(s.docs.map((d) => mapProduct(d.id, d.data())).sort(byNewest)); },
        fail,
      ),
      onSnapshot(
        query(collection(db, 'orders'), where('companyId', '==', companyId), where('orderStatus', 'in', ['processing', 'out_for_delivery'])),
        (s) => { ok(); setOpenOrders(s.docs.map((d) => mapOrder(d.id, d.data())).sort(byNewest)); },
        fail,
      ),
      onSnapshot(
        query(collection(db, 'orders'), where('companyId', '==', companyId), where('orderStatus', '==', 'cancelled'), where('paymentStatus', '==', 'confirmed')),
        (s) => setCancelledPaid(s.docs.map((d) => mapOrder(d.id, d.data())).sort(byNewest)),
        () => undefined,
      ),
      onSnapshot(
        collection(db, 'categories'),
        (s) => setCategories(s.docs.map((d) => mapCategory(d.id, d.data())).filter((c) => !c.trashed)),
        () => undefined,
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [companyId]);

  // There is no server to expire unpaid orders, so the panel does it when it
  // opens and every 5 minutes while it stays open and visible.
  useEffect(() => {
    void expireOverdueOrders(companyId);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void expireOverdueOrders(companyId);
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [companyId]);

  const value = useMemo<CompanyDataValue>(
    () => ({
      companyId,
      company,
      products,
      openOrders,
      pendingPayment: (openOrders ?? []).filter((o) => o.orderStatus === 'processing' && o.paymentStatus === 'pending_verification'),
      pendingRefunds: cancelledPaid.filter(awaitsRefund),
      categories,
      failed,
    }),
    [companyId, company, products, openOrders, cancelledPaid, categories, failed],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompanyData(): CompanyDataValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCompanyData must be used inside CompanyDataProvider');
  return ctx;
}
