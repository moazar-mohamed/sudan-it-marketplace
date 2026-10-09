import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { currentActor } from './auditLog';
import { toDate } from './mappers';

/*
 * Internal notes: a few lines an admin leaves on a company, a customer or an
 * order ("called them, they deliver Sunday"). Only Platform Admins can read or
 * write them (the rules); customers and companies never see them. One document
 * per note, so two admins writing at once never overwrite each other.
 */

export type NoteTarget = 'company' | 'customer' | 'order';

export const NOTE_MAX = 1000;

export interface AdminNote {
  id: string;
  targetType: NoteTarget;
  targetId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: Date | null;
}

export function mapAdminNote(id: string, d: DocumentData): AdminNote {
  return {
    id,
    targetType: d.targetType === 'customer' || d.targetType === 'order' ? d.targetType : 'company',
    targetId: typeof d.targetId === 'string' ? d.targetId : '',
    text: typeof d.text === 'string' ? d.text : '',
    authorId: typeof d.authorId === 'string' ? d.authorId : '',
    authorName: typeof d.authorName === 'string' ? d.authorName : '',
    createdAt: toDate(d.createdAt),
  };
}

const newestFirst = (a: AdminNote, b: AdminNote) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);

/** What is wrong with a note's text, or null when it can be saved. */
export function noteProblem(text: string): 'empty' | 'tooLong' | null {
  const trimmed = text.trim();
  if (trimmed === '') return 'empty';
  return trimmed.length > NOTE_MAX ? 'tooLong' : null;
}

/** The notes on one record, live, newest first. */
export function useAdminNotes(targetType: NoteTarget, targetId: string): {
  status: 'loading' | 'ready' | 'error';
  notes: AdminNote[];
} {
  const key = `${targetType}|${targetId}`;
  const [loaded, setLoaded] = useState<{ key: string; notes: AdminNote[]; failed: boolean } | null>(null);

  useEffect(() => {
    if (!targetId) return undefined;
    // Two equality filters, no ordering: no composite index is needed, the list is sorted here.
    return onSnapshot(
      query(collection(db, 'admin_notes'), where('targetType', '==', targetType), where('targetId', '==', targetId)),
      (snapshot) =>
        setLoaded({ key, notes: snapshot.docs.map((d) => mapAdminNote(d.id, d.data())).sort(newestFirst), failed: false }),
      () => setLoaded({ key, notes: [], failed: true }),
    );
  }, [targetType, targetId, key]);

  const here = targetId && loaded && loaded.key === key ? loaded : null;
  return {
    status: !targetId ? 'ready' : !here ? 'loading' : here.failed ? 'error' : 'ready',
    notes: here?.notes ?? [],
  };
}

/** Saves a note signed with the current admin's id and name. */
export async function addAdminNote(targetType: NoteTarget, targetId: string, text: string): Promise<void> {
  const problem = noteProblem(text);
  if (problem) throw new Error(`note ${problem}`);
  const actor = currentActor();
  await addDoc(collection(db, 'admin_notes'), {
    targetType,
    targetId,
    text: text.trim(),
    authorId: actor.id,
    authorName: actor.name.slice(0, 120),
    createdAt: serverTimestamp(),
  });
}

/** An admin removes a note they wrote. */
export async function deleteAdminNote(id: string): Promise<void> {
  await deleteDoc(doc(db, 'admin_notes', id));
}
