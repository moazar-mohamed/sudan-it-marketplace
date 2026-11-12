import { searchRanked, suggestCorrection, type SearchField } from './searchRanking';
import type { ChatRole, GeoPoint, Job, JobChat, OrderStatus } from './types';

// The job rules of the Flutter technician app (lib/features/technician/):
// the app and this page must show the same thing for the same order.

/** A job that still needs the technician: not completed and not cancelled. */
export const isOpenJob = (job: Job): boolean => job.orderStatus !== 'completed' && job.orderStatus !== 'cancelled';

/**
 * The next allowed status in Processing -> Out for Delivery -> Completed.
 * Pickup orders are never out for delivery, so they complete directly.
 * Completed and cancelled are final (only the company cancels).
 */
export function nextStatus(job: Job): OrderStatus | null {
  if (job.orderStatus === 'processing') return job.deliveryMethod === 'pickup' ? 'completed' : 'out_for_delivery';
  if (job.orderStatus === 'out_for_delivery') return 'completed';
  return null;
}

/** The step the technician can take now: none before the company confirms the payment. */
export function actionOf(job: Job): 'start' | 'finish' | 'waiting' | 'done' | 'cancelled' {
  if (job.orderStatus === 'cancelled') return 'cancelled';
  const next = nextStatus(job);
  if (!next) return 'done';
  if (job.paymentStatus !== 'confirmed') return 'waiting';
  return next === 'completed' ? 'finish' : 'start';
}

/** Great-circle distance in km between two points. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const jobPoint = (job: Job): GeoPoint | null =>
  job.deliveryMethod === 'delivery' && job.deliveryLatitude !== null && job.deliveryLongitude !== null
    ? { latitude: job.deliveryLatitude, longitude: job.deliveryLongitude }
    : null;

/** Distance from [from] to the job's saved delivery point, or null when either is unknown. */
export function jobDistanceKm(job: Job, from: GeoPoint | null): number | null {
  const to = jobPoint(job);
  return from && to ? distanceKm(from, to) : null;
}

/** One decimal under 10 km, rounded above (as the app). */
export const formatKm = (km: number): string => (km < 10 ? km.toFixed(1) : String(Math.round(km)));

/** Among open jobs: payment confirmed first, then the nearest when known, else the oldest. */
export function nextJob(jobs: Job[], from: GeoPoint | null): Job | null {
  const open = jobs.filter(isOpenJob);
  if (open.length === 0) return null;
  open.sort((a, b) => {
    const aPaid = a.paymentStatus === 'confirmed' ? 0 : 1;
    const bPaid = b.paymentStatus === 'confirmed' ? 0 : 1;
    if (aPaid !== bPaid) return aPaid - bPaid;
    const aKm = jobDistanceKm(a, from);
    const bKm = jobDistanceKm(b, from);
    if (aKm !== null && bKm !== null && aKm !== bKm) return aKm - bKm;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return open[0];
}

/** When a completed job counts: its last update, else when it was placed. */
export const completedAt = (job: Job): Date => job.updatedAt ?? job.createdAt;

/** Installation fees of the jobs completed in the month of [now] (SDG, as the app). */
export function monthFees(jobs: Job[], now = new Date()): number {
  let total = 0;
  for (const job of jobs) {
    if (job.orderStatus !== 'completed') continue;
    const at = completedAt(job);
    if (at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth()) total += job.installationFee;
  }
  return total;
}

export function monthCompletedCount(jobs: Job[], now = new Date()): number {
  return jobs.filter((j) => {
    if (j.orderStatus !== 'completed') return false;
    const at = completedAt(j);
    return at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth();
  }).length;
}

/** A link that opens the job's point (or a search for its written address) in the phone's maps app. */
export function directionsUrl(job: Job): string | null {
  const point = jobPoint(job);
  if (point) return `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`;
  const text = job.deliveryAddress.trim();
  if (job.deliveryMethod === 'delivery' && text) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
  return null;
}

/** The short reference people read out: the first 8 characters of the id. */
export const shortId = (id: string): string => (id.length > 8 ? id.slice(0, 8) : id);

/** Phone digits only, so "0912 345 678", "+249912345678" and "912345678" all find the same job. */
export function phoneForms(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return [];
  const local = digits.replace(/^00/, '').replace(/^249/, '').replace(/^0/, '');
  return [digits, local, `0${local}`, `249${local}`];
}

export type JobSearchWords = Record<OrderStatus | 'waiting', string>;

/** Jobs matching [query], best first (the app's search engine), and a "did you mean" when nothing matched. */
export function searchJobs(jobs: Job[], query: string, statusWords: JobSearchWords): { jobs: Job[]; suggestion: string | null } {
  const fields = (j: Job): SearchField[] => [
    { text: j.productName, weight: 3 },
    { text: j.customerName, weight: 2 },
    { text: shortId(j.id), weight: 3 },
    { text: j.id, weight: 1 },
    { text: phoneForms(j.contactPhone).join(' '), weight: 2 },
    { text: j.deliveryAddress, weight: 1 },
    { text: statusWords[j.orderStatus], weight: 1 },
    ...(isOpenJob(j) && j.paymentStatus !== 'confirmed' ? [{ text: statusWords.waiting, weight: 1 }] : []),
  ];
  const q = query.trim();
  if (!q) return { jobs, suggestion: null };
  const found = searchRanked(jobs, q, fields);
  if (found.length > 0) return { jobs: found, suggestion: null };
  const vocabulary = new Set<string>();
  for (const j of jobs) for (const f of fields(j)) for (const w of f.text.split(/\s+/)) if (w.length > 2) vocabulary.add(w);
  return { jobs: [], suggestion: suggestCorrection(q, vocabulary) };
}

/** True when the company wrote the latest message and the technician has not opened the chat since. */
export function chatUnread(chat: JobChat | null | undefined, role: ChatRole = 'technician'): boolean {
  if (!chat?.lastMessageAt || !chat.lastMessageSenderRole) return false;
  if (chat.lastMessageSenderRole === role) return false;
  const readAt = chat.technicianLastReadAt;
  return !readAt || readAt.getTime() < chat.lastMessageAt.getTime();
}

/** First word of a name, for "مرحبًا، محمد". */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? '';

/** The first letter of a name for an avatar. */
export const initial = (name: string): string => Array.from(name.trim())[0] ?? '؟';
