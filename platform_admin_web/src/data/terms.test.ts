import { describe, expect, it } from 'vitest';
import { MAX_TERMS_LENGTH, nextTermsVersion, parseTerms, termsProblem } from './terms';

describe('the terms document', () => {
  it('reads a published one and nothing else', () => {
    expect(parseTerms({ version: 2, textAr: 'ا', textEn: 'a' })).toEqual({ version: 2, textAr: 'ا', textEn: 'a', updatedAt: null });
    expect(parseTerms(undefined)).toBeNull();
    expect(parseTerms({ version: 0, textAr: 'ا', textEn: '' })).toBeNull();
    expect(parseTerms({ version: '1', textAr: 'ا', textEn: '' })).toBeNull();
  });

  it('reads the time it was published', () => {
    const when = new Date('2026-11-05T10:00:00Z');
    expect(parseTerms({ version: 1, textAr: 'ا', textEn: '', updatedAt: { toDate: () => when } })?.updatedAt).toBe(when);
  });
});

describe('what can be published', () => {
  it('needs the Arabic text and keeps both within the limit', () => {
    expect(termsProblem('', 'English only')).toBe('terms.problem.empty');
    expect(termsProblem('   ', '')).toBe('terms.problem.empty');
    expect(termsProblem('ا'.repeat(MAX_TERMS_LENGTH + 1), '')).toBe('terms.problem.tooLong');
    expect(termsProblem('ا', 'a'.repeat(MAX_TERMS_LENGTH + 1))).toBe('terms.problem.tooLong');
    expect(termsProblem('نص', '')).toBeNull();
  });
});

describe('the version being published', () => {
  const current = { version: 3, textAr: 'ا', textEn: '', updatedAt: null };

  it('starts at 1', () => {
    expect(nextTermsVersion(null, true)).toBe(1);
    expect(nextTermsVersion(null, false)).toBe(1);
  });

  it('keeps the number for a correction and adds one when everyone must accept again', () => {
    expect(nextTermsVersion(current, false)).toBe(3);
    expect(nextTermsVersion(current, true)).toBe(4);
  });
});
