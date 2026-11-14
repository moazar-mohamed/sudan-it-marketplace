import { describe, expect, it } from 'vitest';
import { MAX_TERMS_LENGTH, termsProblem } from './terms';
import { DEFAULT_TERMS_AR, DEFAULT_TERMS_EN } from './termsDefault';

/** The section numbers a text names ("1.", "2." ...), in Western or Arabic-Indic digits. */
const sectionNumbers = (text: string): number[] =>
  [...text.matchAll(/^([0-9\u0660-\u0669]+)[.\u002E] /gm)].map((m) =>
    Number(m[1].replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))),
  );

describe('the standard terms', () => {
  it('can be published as they are', () => {
    expect(termsProblem(DEFAULT_TERMS_AR, DEFAULT_TERMS_EN)).toBeNull();
    expect(DEFAULT_TERMS_AR.length).toBeLessThan(MAX_TERMS_LENGTH);
    expect(DEFAULT_TERMS_EN.length).toBeLessThan(MAX_TERMS_LENGTH);
  });

  it('number their 30 sections the same way in both languages', () => {
    const wanted = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(sectionNumbers(DEFAULT_TERMS_EN)).toEqual(wanted);
    expect(sectionNumbers(DEFAULT_TERMS_AR)).toEqual(wanted);
  });

  it('say nothing that is still to be filled in', () => {
    for (const text of [DEFAULT_TERMS_AR, DEFAULT_TERMS_EN]) {
      expect(text).not.toMatch(/TODO|\[\.\.\.\]|XXX|lorem|sample|نموذج/i);
    }
  });
});
