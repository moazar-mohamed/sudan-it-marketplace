import { describe, expect, it } from 'vitest';
import { ar, en } from './dictionary';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionary', () => {
  const keys = Object.keys(en) as (keyof typeof en)[];

  it('has the same keys in English and Arabic', () => {
    expect(Object.keys(ar).sort()).toEqual([...keys].sort());
  });

  it('has no empty translation', () => {
    for (const key of keys) {
      expect(en[key].trim(), `en ${key}`).not.toBe('');
      expect(ar[key].trim(), `ar ${key}`).not.toBe('');
    }
  });

  it('uses the same {placeholders} in both languages', () => {
    for (const key of keys) {
      expect(placeholders(ar[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('actually translates the text (Arabic script, not a copy of the English)', () => {
    // These are the same in both languages on purpose (proper names, symbols).
    const sameOnPurpose = new Set(['settings.languageEnglish', 'settings.languageArabic']);
    for (const key of keys) {
      if (sameOnPurpose.has(key)) continue;
      const hasLetters = /[A-Za-z]{3}/.test(en[key]);
      if (hasLetters) expect(ar[key], key).toMatch(/[؀-ۿ]/);
    }
  });

  it('names each language in its own language', () => {
    expect(en['settings.languageEnglish']).toBe('English');
    expect(ar['settings.languageEnglish']).toBe('English');
    expect(en['settings.languageArabic']).toBe('العربية');
    expect(ar['settings.languageArabic']).toBe('العربية');
  });
});
