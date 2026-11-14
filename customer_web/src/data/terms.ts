import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import type { Language } from '../i18n';

/** The terms and conditions Platform Admin published (platform_settings/terms). */
export interface Terms {
  version: number;
  textAr: string;
  textEn: string;
  updatedAt: Date | null;
}

/** The terms as stored, or null when the document is not a published one. */
export function mapTerms(d: DocumentData | undefined): Terms | null {
  if (!d || typeof d.version !== 'number' || !Number.isInteger(d.version) || d.version < 1) return null;
  const text = (v: unknown): string => (typeof v === 'string' ? v : '');
  const stamp = d.updatedAt && typeof d.updatedAt.toDate === 'function' ? (d.updatedAt.toDate() as Date) : null;
  const terms = { version: d.version, textAr: text(d.textAr), textEn: text(d.textEn), updatedAt: stamp };
  return terms.textAr.trim() === '' && terms.textEn.trim() === '' ? null : terms;
}

/** The text in the reader's language, or in the other one when it has not been written. */
export function termsText(terms: Terms, language: Language): string {
  const own = language === 'en' ? terms.textEn : terms.textAr;
  const other = language === 'en' ? terms.textAr : terms.textEn;
  return own.trim() !== '' ? own : other;
}

/**
 * Whether a person still has to accept: terms are published and they have not
 * accepted this version. Without published terms nobody has to; a correction
 * that keeps the version number does not ask again.
 */
export const needsTerms = (terms: Terms | null, acceptedVersion: number | null): boolean =>
  terms !== null && (acceptedVersion === null || acceptedVersion < terms.version);

export interface TermsState {
  /** Null when none are published (or they could not be read). */
  terms: Terms | null;
  /** The first answer has arrived. */
  loaded: boolean;
}

/** The published terms, live; readable before signing in. */
export function useTerms(): TermsState {
  const [state, setState] = useState<TermsState>({ terms: null, loaded: false });
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'platform_settings', 'terms'),
        (snap) => setState({ terms: snap.exists() ? mapTerms(snap.data()) : null, loaded: true }),
        () => setState({ terms: null, loaded: true }),
      ),
    [],
  );
  return state;
}

/** Records that this person accepted [version] now; the rules check it is the published one. */
export async function acceptTerms(uid: string, version: number): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'users', uid), { termsVersion: version, termsAcceptedAt: serverTimestamp() });
    return true;
  } catch {
    return false;
  }
}
