import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EN } from './i18nEn';

const SRC = __dirname;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name) && e.name !== 'i18nEn.ts' ? [path] : [];
  });

/** Every Arabic text the panel passes to t('...'). */
function usedTexts(): { text: string; file: string }[] {
  const found: { text: string; file: string }[] = [];
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/\bt\('((?:[^'\\\n]|\\.)*)'/g)) {
      const text = m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
      if (/[؀-ۿ]/.test(text)) found.push({ text, file: file.slice(SRC.length + 1) });
    }
  }
  return found;
}

describe('English texts', () => {
  it('has an English text for every Arabic text the panel shows', () => {
    const missing = usedTexts().filter((u) => !(u.text in EN));
    expect(missing.map((u) => `${u.file}: ${u.text}`)).toEqual([]);
  });

  it('keeps the same {0}, {1} places in the English text as in the Arabic one', () => {
    const places = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join(',');
    const broken = Object.entries(EN).filter(([ar, en]) => places(ar) !== places(en) && en !== '');
    // A few Arabic texts carry a place the English drops (a suffix letter): those are listed here on purpose.
    expect(broken.map(([ar]) => ar)).toEqual(['عليه {0} مفتوح{1}. لو حُذف لن تستطيع تأكيدها، وقد يكون أصحابها حوّلوا المبلغ بالفعل.']);
  });
});
