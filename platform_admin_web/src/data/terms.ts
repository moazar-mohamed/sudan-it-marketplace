import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';

/*
 * The terms and conditions (platform_settings/terms): a version number and the
 * text in Arabic and in English. Customers read them before signing in; they
 * accept the published version when they sign up, and again whenever a new
 * version (the number goes up) is published. A correction keeps the number, so
 * nobody is asked twice for a typo.
 */

/** The most characters one text may hold (the rules refuse more). */
export const MAX_TERMS_LENGTH = 50000;

export interface Terms {
  version: number;
  textAr: string;
  textEn: string;
  updatedAt: Date | null;
}

/** The terms as stored, or null when the document is missing or not a published one. */
export function parseTerms(data: Record<string, unknown> | undefined): Terms | null {
  if (!data || typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) return null;
  const updated = data.updatedAt as { toDate?: () => Date } | null | undefined;
  return {
    version: data.version,
    textAr: typeof data.textAr === 'string' ? data.textAr : '',
    textEn: typeof data.textEn === 'string' ? data.textEn : '',
    updatedAt: updated && typeof updated.toDate === 'function' ? updated.toDate() : null,
  };
}

export type TermsProblem = 'terms.problem.empty' | 'terms.problem.tooLong';

/** What stops the texts from being published, as a dictionary key, or null. The Arabic text is required. */
export function termsProblem(textAr: string, textEn: string): TermsProblem | null {
  if (textAr.trim() === '') return 'terms.problem.empty';
  if (textAr.length > MAX_TERMS_LENGTH || textEn.length > MAX_TERMS_LENGTH) return 'terms.problem.tooLong';
  return null;
}

/** The first publication is version 1; later ones keep the number (a correction) or add one. */
export const nextTermsVersion = (current: Terms | null, askAgain: boolean): number =>
  current === null ? 1 : askAgain ? current.version + 1 : current.version;

export interface TermsState {
  status: 'loading' | 'ready' | 'error';
  /** Null while nothing is published. */
  terms: Terms | null;
}

/** The live terms document. */
export function useTerms(): TermsState {
  const [state, setState] = useState<TermsState>({ status: 'loading', terms: null });
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'platform_settings', 'terms'),
        (snapshot) => setState({ status: 'ready', terms: parseTerms(snapshot.data()) }),
        () => setState({ status: 'error', terms: null }),
      ),
    [],
  );
  return state;
}
