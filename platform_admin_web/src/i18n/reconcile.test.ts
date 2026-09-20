import { describe, expect, it } from 'vitest';
import { reconcileLanguage } from './reconcile';

describe('reconcileLanguage', () => {
  it('a language stored on the profile wins over this browser', () => {
    expect(reconcileLanguage('ar', 'en', false)).toEqual({ adopt: 'ar' });
    expect(reconcileLanguage('en', 'ar', false)).toEqual({ adopt: 'en' });
    expect(reconcileLanguage('ar', null, false)).toEqual({ adopt: 'ar' });
  });

  it('with no stored language, the browser choice is saved to the profile', () => {
    expect(reconcileLanguage(undefined, 'ar', false)).toEqual({ push: 'ar' });
    expect(reconcileLanguage(undefined, 'en', false)).toEqual({ push: 'en' });
  });

  it('with neither, nothing is read or written (English stays the default)', () => {
    expect(reconcileLanguage(undefined, null, false)).toEqual({});
  });

  it('a choice that could not be saved yet is pushed, not overwritten by the old profile value', () => {
    expect(reconcileLanguage('en', 'ar', true)).toEqual({ push: 'ar' });
  });

  it('a pending flag without any browser choice falls back to the profile', () => {
    expect(reconcileLanguage('ar', null, true)).toEqual({});
  });
});
