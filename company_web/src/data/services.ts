import { collection, deleteField, doc, type DocumentData, type Query, getDoc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { mapCatalogService, mapCompanyService, toDate } from './mappers';
import { sendNotice } from './notify';
import type { CatalogService, CompanyService, OfferBadge } from './types';
import { t } from '../i18n';

export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';

export interface ServiceRequest {
  id: string;
  customerId: string;
  customerName: string;
  serviceName: string;
  details: string;
  address: string;
  contactPhone: string;
  price: number | null;
  status: RequestStatus;
  createdAt: Date;
}

const statusOf = (v: unknown): RequestStatus =>
  v === 'accepted' || v === 'rejected' || v === 'in_progress' || v === 'completed' || v === 'cancelled' ? v : 'pending';

function live<T>(make: () => Query, map: (id: string, d: DocumentData) => T, deps: unknown[]): T[] | null {
  const [list, setList] = useState<T[] | null>(null);
  useEffect(
    () => onSnapshot(make(), (s) => setList(s.docs.map((d) => map(d.id, d.data()))), () => setList([])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
  return list;
}

export const useCompanyServices = (companyId: string): CompanyService[] | null =>
  live(() => query(collection(db, 'company_services'), where('companyId', '==', companyId)), mapCompanyService, [companyId]);

/** The active services of the platform catalogue plus this company's own (others' own services are theirs). */
export function useCatalogServices(companyId: string): CatalogService[] | null {
  const all = live(() => query(collection(db, 'services'), where('isActive', '==', true)), mapCatalogService, []);
  return all === null ? null : all.filter((s) => !s.ownerCompanyId || s.ownerCompanyId === companyId);
}

/** Every service the company has ever linked, inactive ones included, by id (to name a link whose service was switched off). */
export function useServiceNames(services: CatalogService[] | null): Map<string, CatalogService> {
  return new Map((services ?? []).map((s) => [s.id, s]));
}

export function useServiceRequests(companyId: string): ServiceRequest[] | null {
  const list = live<ServiceRequest>(
    () => query(collection(db, 'service_requests'), where('companyId', '==', companyId)),
    (id, d) => ({
      id,
      customerId: String(d.customerId ?? ''),
      customerName: String(d.customerName ?? ''),
      serviceName: String(d.serviceName ?? ''),
      details: String(d.details ?? ''),
      address: String(d.address ?? ''),
      contactPhone: String(d.contactPhone ?? ''),
      price: typeof d.price === 'number' ? d.price : null,
      status: statusOf(d.status),
      createdAt: toDate(d.createdAt) ?? new Date(),
    }),
    [companyId],
  );
  return list === null ? null : [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

const NO_OFFER = { offerPrice: null, offerEndsAt: null, offerBadge: null };

export class ServiceError extends Error {
  constructor(readonly problem: 'exists' | 'price-below-offer' | 'category' | 'failed') {
    super(problem);
  }
}

/** Starts offering a catalogue service (one document per company + service; an old one is switched back on). */
export async function addCompanyService(companyId: string, serviceId: string, price: number | null, note: string): Promise<void> {
  const ref = doc(db, 'company_services', `${companyId}_${serviceId}`);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    if (existing.data().isActive === true) throw new ServiceError('exists');
    // An offer from before it was removed does not come back.
    await updateDoc(ref, { isActive: true, price, note: note.trim(), ...NO_OFFER, updatedAt: serverTimestamp() });
    return;
  }
  await setDoc(ref, {
    id: ref.id,
    companyId,
    serviceId,
    isActive: true,
    price,
    note: note.trim(),
    ...NO_OFFER,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Changes the company's price and note; a running offer must stay below the price. */
export async function updateCompanyService(link: CompanyService, price: number | null, note: string): Promise<void> {
  const hasOffer = link.offerPrice !== null;
  const offerRuns = hasOffer && (link.offerEndsAt === null || link.offerEndsAt.getTime() > Date.now());
  if (hasOffer && (price === null || price <= (link.offerPrice as number))) {
    if (offerRuns) throw new ServiceError('price-below-offer');
    await updateDoc(doc(db, 'company_services', link.id), { price, note: note.trim(), ...NO_OFFER, updatedAt: serverTimestamp() });
    return;
  }
  await updateDoc(doc(db, 'company_services', link.id), { price, note: note.trim(), updatedAt: serverTimestamp() });
}

/** Stops (or resumes) offering a service. Past requests are kept. */
export async function setServiceActive(link: CompanyService, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'company_services', link.id), {
    isActive: active,
    ...(active ? NO_OFFER : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function setServiceOffer(
  linkId: string,
  offer: { offerPrice: number | null; offerEndsAt: Date | null; offerBadge: OfferBadge | null },
): Promise<void> {
  await updateDoc(doc(db, 'company_services', linkId), {
    offerPrice: offer.offerPrice,
    offerEndsAt: offer.offerPrice === null || !offer.offerEndsAt ? null : Timestamp.fromDate(offer.offerEndsAt),
    offerBadge: offer.offerPrice === null ? null : offer.offerBadge,
    updatedAt: serverTimestamp(),
  });
}

/** Creates a service owned by this company and starts offering it; if offering fails, the new service is switched off again. */
export async function createOwnService(
  companyId: string,
  input: { categoryId: string; name: string; description: string; price: number | null; note: string },
): Promise<void> {
  const ref = doc(collection(db, 'services'));
  try {
    await setDoc(ref, {
      id: ref.id,
      categoryId: input.categoryId,
      name: input.name.trim(),
      description: input.description.trim(),
      isActive: true,
      ownerCompanyId: companyId,
      createdAt: serverTimestamp(),
    });
  } catch {
    throw new ServiceError('category');
  }
  try {
    await addCompanyService(companyId, ref.id, input.price, input.note);
  } catch (e) {
    await updateDoc(ref, { isActive: false }).catch(() => undefined);
    throw e;
  }
}

/** Edits a service this company created (name, description, category). */
export async function updateOwnService(
  serviceId: string,
  input: { categoryId: string; name: string; description: string },
): Promise<void> {
  await updateDoc(doc(db, 'services', serviceId), {
    categoryId: input.categoryId,
    name: input.name.trim(),
    description: input.description.trim(),
  });
}

/** Stops offering an own service and hides the service itself. */
export async function removeOwnService(link: CompanyService): Promise<void> {
  await updateDoc(doc(db, 'company_services', link.id), { isActive: false, updatedAt: serverTimestamp() });
  await updateDoc(doc(db, 'services', link.serviceId), { isActive: false });
}

const NEXT: Partial<Record<RequestStatus, RequestStatus[]>> = {
  pending: ['accepted', 'rejected'],
  accepted: ['in_progress'],
  in_progress: ['completed'],
};
export const nextRequestStatuses = (s: RequestStatus): RequestStatus[] => NEXT[s] ?? [];

export const REQUEST_LABEL: Record<RequestStatus, string> = {
  pending: t('جديد'),
  accepted: t('مقبول'),
  rejected: t('مرفوض'),
  in_progress: t('قيد التنفيذ'),
  completed: t('مكتمل'),
  cancelled: t('ألغاه العميل'),
};

export async function setRequestStatus(request: ServiceRequest, status: RequestStatus): Promise<boolean> {
  await updateDoc(doc(db, 'service_requests', request.id), { status, updatedAt: serverTimestamp() });
  const type =
    status === 'accepted' ? 'service_request_accepted'
    : status === 'rejected' ? 'service_request_rejected'
    : status === 'in_progress' ? 'service_request_in_progress'
    : status === 'completed' ? 'service_request_completed'
    : null;
  if (!type) return true;
  return sendNotice({ type, recipientType: 'customer', recipientId: request.customerId, serviceRequestId: request.id, productName: request.serviceName });
}

export { deleteField };
