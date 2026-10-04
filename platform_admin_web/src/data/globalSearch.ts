import {
  collection,
  documentId,
  getDocs,
  limit,
  query,
  where,
  type DocumentData,
  type Firestore,
  type Query,
} from 'firebase/firestore';
import type { Piece } from './dashboardData';
import { mapCompany, mapCustomer, mapOrder, mapProduct } from './mappers';
import type { Company, Customer, Order, Product } from './types';

/*
 * The search box (Ctrl+K). Firestore has no full-text search, and the panel
 * does not keep every collection open, so a search is a handful of small
 * "starts with" queries (name >= term and name <= term + a high character),
 * a few documents each, run when the admin pauses typing. That means it finds
 * what a name or an order number STARTS with; it does not find the middle of a
 * word. Latin letters are tried as typed, in lower case, with a capital first
 * letter and in Title Case, because the stored names are case-sensitive.
 */

export const MIN_SEARCH_LENGTH = 2;
export const HITS_PER_GROUP = 5;
/** A character that sorts after every other: `value + END` closes a "starts with" range. */
const END = '';

export type SearchKind = 'company' | 'customer' | 'order' | 'product';
export const SEARCH_KINDS: SearchKind[] = ['company', 'customer', 'order', 'product'];

export type SearchHit =
  | { kind: 'company'; item: Company }
  | { kind: 'customer'; item: Customer }
  | { kind: 'order'; item: Order }
  | { kind: 'product'; item: Product };

export type SearchResults = Record<SearchKind, Piece<SearchHit[]>>;

/** Where a result opens. */
export const hitPath = (hit: SearchHit): string =>
  ({ company: '/companies', customer: '/customers', order: '/orders', product: '/products' })[hit.kind] + `/${hit.item.id}`;

/** What is typed, as the several spellings a case-sensitive "starts with" query has to try. */
export function searchVariants(raw: string): string[] {
  const term = raw.trim();
  if (!term) return [];
  const variants = [term];
  if (/[A-Za-z]/.test(term)) {
    const lower = term.toLowerCase();
    variants.push(lower);
    variants.push(lower.charAt(0).toUpperCase() + lower.slice(1));
    variants.push(lower.replace(/(^|[\s\-_.])([a-z])/g, (_, gap: string, letter: string) => gap + letter.toUpperCase()));
  }
  return [...new Set(variants)];
}

/** One "starts with" query: which collection, which field, what it starts with. */
export interface QueryPlan {
  kind: SearchKind;
  collection: 'companies' | 'users' | 'products' | 'orders';
  /** The document id when '__id__'. */
  field: string;
  value: string;
  /** Customers are the users whose role is "customer" (the rules only let Platform Admin list those). */
  customersOnly?: boolean;
}

/** The queries one search runs; none for a term that is too short. */
export function planSearch(raw: string): QueryPlan[] {
  const term = raw.trim();
  if (term.length < MIN_SEARCH_LENGTH) return [];
  const plans: QueryPlan[] = [];
  for (const value of searchVariants(term)) {
    plans.push({ kind: 'company', collection: 'companies', field: 'name', value });
    plans.push({ kind: 'product', collection: 'products', field: 'name', value });
    plans.push({ kind: 'customer', collection: 'users', field: 'fullName', value, customersOnly: true });
    plans.push({ kind: 'order', collection: 'orders', field: 'customerName', value });
  }
  // E-mail addresses are stored in lower case.
  if (/[A-Za-z@.]/.test(term)) {
    plans.push({ kind: 'customer', collection: 'users', field: 'email', value: term.toLowerCase(), customersOnly: true });
  }
  // An order number is the first 8 characters of its id (shown as #abcd1234).
  const id = term.replace(/^#/, '');
  if (/^[A-Za-z0-9]{3,}$/.test(id)) {
    plans.push({ kind: 'order', collection: 'orders', field: '__id__', value: id });
  }
  return plans;
}

const toQuery = (db: Firestore, plan: QueryPlan): Query<DocumentData> => {
  const field = plan.field === '__id__' ? documentId() : plan.field;
  const range = [where(field, '>=', plan.value), where(field, '<=', plan.value + END)];
  const base = collection(db, plan.collection);
  return plan.customersOnly
    ? query(base, where('role', '==', 'customer'), ...range, limit(HITS_PER_GROUP))
    : query(base, ...range, limit(HITS_PER_GROUP));
};

const toHit = (kind: SearchKind, id: string, data: DocumentData): SearchHit => {
  switch (kind) {
    case 'company':
      return { kind, item: mapCompany(id, data) };
    case 'customer':
      return { kind, item: mapCustomer(id, data) };
    case 'order':
      return { kind, item: mapOrder(id, data) };
    case 'product':
      return { kind, item: mapProduct(id, data) };
  }
};

/**
 * Runs the search. Each kind of record has its own result: if every query of a
 * kind fails (an index still building, say) that kind shows as unavailable
 * without hiding the others; if only some fail, what the others found is kept.
 */
export async function searchRecords(db: Firestore, raw: string): Promise<SearchResults> {
  const plans = planSearch(raw);
  const empty = (): Piece<SearchHit[]> => ({ ok: true, value: [] });
  const results: SearchResults = { company: empty(), customer: empty(), order: empty(), product: empty() };

  await Promise.all(
    SEARCH_KINDS.map(async (kind) => {
      const own = plans.filter((p) => p.kind === kind);
      if (own.length === 0) return;
      const settled = await Promise.allSettled(own.map((plan) => getDocs(toQuery(db, plan))));
      if (settled.every((s) => s.status === 'rejected')) {
        results[kind] = { ok: false };
        return;
      }
      const seen = new Set<string>();
      const hits: SearchHit[] = [];
      for (const s of settled) {
        if (s.status !== 'fulfilled') continue;
        for (const d of s.value.docs) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          hits.push(toHit(kind, d.id, d.data()));
        }
      }
      results[kind] = { ok: true, value: hits.slice(0, HITS_PER_GROUP) };
    }),
  );
  return results;
}
