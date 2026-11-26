import { doc, serverTimestamp, Timestamp, writeBatch, type DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { stageAudit } from './auditLog';

/**
 * A company's request to join (company_applications/{uid}), sent from the
 * person's own customer account on the customer site. Approving turns that same
 * account into the company's admin (the customer page's "Convert to company"),
 * then marks the request approved; rejecting gives a reason the sender reads.
 */
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export const APPLICATION_STATUSES: ApplicationStatus[] = ['pending', 'approved', 'rejected'];

export interface CompanyApplication {
  id: string;
  applicantEmail: string;
  companyName: string;
  contactName: string;
  phone: string;
  cityId: string;
  registrationNumber: string;
  about: string;
  status: ApplicationStatus;
  decisionNote: string;
  createdAt: Date | null;
  decidedAt: Date | null;
}

export const DECISION_NOTE_MAX = 500;

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const date = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

export function mapCompanyApplication(id: string, d: DocumentData): CompanyApplication {
  const status: ApplicationStatus = d.status === 'approved' || d.status === 'rejected' ? d.status : 'pending';
  return {
    id,
    applicantEmail: text(d.applicantEmail),
    companyName: text(d.companyName),
    contactName: text(d.contactName),
    phone: text(d.phone),
    cityId: text(d.cityId),
    registrationNumber: text(d.registrationNumber),
    about: text(d.about),
    status,
    decisionNote: text(d.decisionNote),
    createdAt: date(d.createdAt),
    decidedAt: date(d.decidedAt),
  };
}

/** Records the decision (the rules accept it only on a pending request; a rejection needs a reason). */
export async function decideApplication(
  application: CompanyApplication,
  status: 'approved' | 'rejected',
  note = '',
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'company_applications', application.id), {
    status,
    decisionNote: note.trim().slice(0, DECISION_NOTE_MAX),
    decidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  stageAudit(batch, {
    action: status === 'approved' ? 'application.approve' : 'application.reject',
    targetType: 'customer',
    targetId: application.id,
    targetName: application.companyName,
    detail: status,
  });
  await batch.commit();
}
