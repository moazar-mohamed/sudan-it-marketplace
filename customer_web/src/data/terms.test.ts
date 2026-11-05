import { describe, expect, it } from 'vitest';
import { mapTerms, needsTerms, termsText } from './terms';

const published = { version: 2, textAr: 'الشروط', textEn: 'Terms' };

describe('the published terms', () => {
  it('reads a published document and nothing else', () => {
    expect(mapTerms(published)).toEqual({ version: 2, textAr: 'الشروط', textEn: 'Terms', updatedAt: null });
    expect(mapTerms(undefined)).toBeNull();
    expect(mapTerms({ ...published, version: 0 })).toBeNull();
    expect(mapTerms({ ...published, version: '2' })).toBeNull();
    expect(mapTerms({ version: 1, textAr: ' ', textEn: '' })).toBeNull();
  });

  it('shows the reader their language and falls back to the other one', () => {
    const terms = mapTerms(published)!;
    expect(termsText(terms, 'ar')).toBe('الشروط');
    expect(termsText(terms, 'en')).toBe('Terms');
    expect(termsText({ ...terms, textEn: '' }, 'en')).toBe('الشروط');
    expect(termsText({ ...terms, textAr: '  ' }, 'ar')).toBe('Terms');
  });
});

describe('who has to accept', () => {
  const terms = mapTerms(published)!;

  it('nobody while nothing is published', () => {
    expect(needsTerms(null, null)).toBe(false);
  });

  it('whoever has not accepted this version', () => {
    expect(needsTerms(terms, null)).toBe(true);
    expect(needsTerms(terms, 1)).toBe(true);
    expect(needsTerms(terms, 2)).toBe(false);
  });
});
