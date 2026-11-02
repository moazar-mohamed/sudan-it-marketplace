import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from './hooks';
import type { Loaded } from './hooks';
import { mapServiceRequest } from './mappers';
import type { ServiceRequest, ServiceRequestDraft, ServiceRequestStatus } from './types';
import { t } from '../i18n';

// Port of the app's service request layer. A request and its conversation (same
// id) are one batch: the rules accept each only together with the other.

export const DETAILS_MAX = 2000;
export const ADDRESS_MAX = 500;
const CUSTOMER_NAME_MAX = 120;
const DRAFT_KEY = 'service_request_draft_';

/** A message for the customer: why nothing changed. */
export class RequestRefused extends Error {}

export const REQUEST_STATUS: Record<ServiceRequestStatus, { label: string; tone: string }> = {
  pending: { label: t('قيد الانتظار'), tone: 'warn' },
  accepted: { label: t('مقبول'), tone: 'info' },
  in_progress: { label: t('قيد التنفيذ'), tone: 'info' },
  completed: { label: t('مكتمل'), tone: 'ok' },
  rejected: { label: t('مرفوض'), tone: 'off' },
  cancelled: { label: t('ملغى'), tone: 'off' },
};

/** The steps a request moves through when it goes well. */
export const REQUEST_STEPS: ServiceRequestStatus[] = ['pending', 'accepted', 'in_progress', 'completed'];

/** No further change can happen to a request in this status. */
export const isFinished = (r: ServiceRequest): boolean =>
  r.status === 'completed' || r.status === 'rejected' || r.status === 'cancelled';

export const newRequestId = (): string => doc(collection(db, 'service_requests')).id;

function notify(request: Pick<ServiceRequest, 'id' | 'companyId' | 'serviceName'>, type: 'new_service_request' | 'service_request_cancelled'): Promise<void> {
  const id = `${request.id}_${type}`;
  return setDoc(doc(db, 'notifications', id), {
    id,
    recipientType: 'company_admin',
    recipientId: request.companyId,
    serviceRequestId: request.id,
    type,
    productName: request.serviceName,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

export async function sendRequest(draft: ServiceRequestDraft): Promise<void> {
  const customerName = draft.customerName.trim().slice(0, CUSTOMER_NAME_MAX);
  const batch = writeBatch(db);
  batch.set(doc(db, 'service_requests', draft.id), {
    id: draft.id,
    customerId: draft.customerId,
    customerName,
    companyId: draft.companyId,
    companyName: draft.companyName,
    companyServiceId: draft.companyServiceId,
    serviceId: draft.serviceId,
    serviceName: draft.serviceName,
    price: draft.price,
    details: draft.details.trim(),
    address: draft.address.trim(),
    latitude: draft.latitude,
    longitude: draft.longitude,
    cityId: draft.cityId,
    contactPhone: draft.contactPhone,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'chats', draft.id), {
    id: draft.id,
    serviceRequestId: draft.id,
    orderId: null,
    customerId: draft.customerId,
    companyId: draft.companyId,
    customerName,
    companyName: draft.companyName,
    serviceName: draft.serviceName,
    productName: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    throw new RequestRefused(
      error instanceof FirebaseError && error.code === 'permission-denied'
        ? t('تعذر إرسال هذا الطلب. ربما لم تعد الشركة تقدم هذه الخدمة.')
        : t('تعذر إرسال الطلب. يرجى المحاولة مرة أخرى.'),
    );
  }
  // A notification that fails to send never undoes the request.
  await notify({ id: draft.id, companyId: draft.companyId, serviceName: draft.serviceName }, 'new_service_request').catch(() => undefined);
}

/** The customer may withdraw a request only while the company has not answered. */
export async function cancelRequest(request: ServiceRequest): Promise<void> {
  try {
    await updateDoc(doc(db, 'service_requests', request.id), { status: 'cancelled', updatedAt: serverTimestamp() });
  } catch {
    throw new RequestRefused(t('تعذر تحديث الطلب. يرجى المحاولة مرة أخرى.'));
  }
  await notify(request, 'service_request_cancelled').catch(() => undefined);
}

/** Newest first, sorted here so no composite index is needed. */
export function useMyRequests(uid: string): Loaded<ServiceRequest> {
  const r = useCollection<ServiceRequest>(
    () => query(collection(db, 'service_requests'), where('customerId', '==', uid)),
    mapServiceRequest,
    uid,
  );
  return { ...r, items: r.items ? [...r.items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) : null };
}

/** One request, live; null when it is not there or is not the reader's. */
export function useServiceRequest(id: string | null): { request: ServiceRequest | null; loaded: boolean } {
  const [state, setState] = useState<{ id: string | null; request: ServiceRequest | null; loaded: boolean }>({ id, request: null, loaded: false });
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'service_requests', id),
      (snap) => setState({ id, request: snap.exists() ? mapServiceRequest(snap.id, snap.data()) : null, loaded: true }),
      () => setState({ id, request: null, loaded: true }),
    );
  }, [id]);
  return state.id === id ? state : { request: null, loaded: false };
}

export interface FormDraft {
  details: string;
  address: string;
}

// What was typed before leaving the form. It stays on this device, and a browser
// that refuses storage only loses the convenience.
export function loadFormDraft(offerId: string): FormDraft {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY + offerId) ?? 'null');
    return { details: typeof saved?.details === 'string' ? saved.details : '', address: typeof saved?.address === 'string' ? saved.address : '' };
  } catch {
    return { details: '', address: '' };
  }
}

export function saveFormDraft(offerId: string, draft: FormDraft): void {
  try {
    if (draft.details.trim() === '' && draft.address.trim() === '') localStorage.removeItem(DRAFT_KEY + offerId);
    else localStorage.setItem(DRAFT_KEY + offerId, JSON.stringify(draft));
  } catch {
    // Nothing to do: the form still works.
  }
}
