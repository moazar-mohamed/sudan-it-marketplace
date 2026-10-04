import { collection, doc, serverTimestamp, setDoc, type WriteBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { AuditTargetType } from './types';

/*
 * The activity trail: one append-only document per thing Platform Admin does
 * (admin_audit_log). The rules let only the signed-in admin write an entry in
 * their own name, stamped with the server's time, and nobody edit or delete one.
 *
 * A change that is one document write carries its entry in the same batch
 * (stageAudit), so the change and its entry succeed or fail together. A change
 * that already spans many writes (creating an account, deleting a company, a
 * category move) records its entry once it has succeeded (recordAudit), and a
 * failure to record never turns a finished change into an error - the admin
 * would otherwise repeat it.
 */

export interface AuditInput {
  /** Machine code, e.g. `company.status`; the Activity page names it from the dictionary. */
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  targetName?: string;
  /** The new value where there is one (a status, hidden / shown ...). */
  detail?: string;
}

export interface AuditActor {
  id: string;
  name: string;
}

const clip = (value: string | undefined, max: number) => (value ?? '').trim().slice(0, max);

/** The fields of one entry, without the server timestamp. Exactly what the rules accept. */
export function buildAuditEntry(actor: AuditActor, input: AuditInput) {
  const detail = clip(input.detail, 200);
  return {
    actorId: actor.id,
    actorName: clip(actor.name, 200),
    action: clip(input.action, 60),
    targetType: input.targetType,
    targetId: clip(input.targetId, 128),
    targetName: clip(input.targetName, 200),
    ...(detail ? { detail } : {}),
  };
}

let actorName = '';

/** Called by the auth provider so entries carry the admin's name, not just a uid. */
export function setAuditActorName(name: string) {
  actorName = name;
}

function currentActor(): AuditActor {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  return { id: user.uid, name: actorName || user.email || user.uid };
}

/** Adds the entry for a change to the batch that makes that change. */
export function stageAudit(batch: WriteBatch, input: AuditInput): void {
  batch.set(doc(collection(db, 'admin_audit_log')), {
    ...buildAuditEntry(currentActor(), input),
    createdAt: serverTimestamp(),
  });
}

/** Records the entry for a change that has already succeeded; never throws. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await setDoc(doc(collection(db, 'admin_audit_log')), {
      ...buildAuditEntry(currentActor(), input),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Could not record the activity entry', error);
  }
}
