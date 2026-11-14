import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain .mjs helper shared with the command line
import { i18nKeys } from '../scripts/i18nKeys.mjs';
import { EN } from './i18nEn';

describe('English', () => {
  it('has a translation for every text the portal shows', () => {
    const missing = (i18nKeys('src') as string[]).filter((k) => !(k in EN));
    expect(missing).toEqual([]);
  });

  it('keeps the {0} placeholders of each text', () => {
    for (const [ar, en] of Object.entries(EN)) {
      const holes = (s: string) => (s.match(/\{\d\}/g) ?? []).sort().join();
      expect(holes(en), ar).toBe(holes(ar));
    }
  });
});
