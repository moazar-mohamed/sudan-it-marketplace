// Lists every Arabic text passed to t() in src/ (the keys i18nEn.ts must translate).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function i18nKeys(dir = 'src') {
  const out = new Set();
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f) && !f.endsWith('.test.ts') && f !== 'i18nEn.ts') {
        for (const m of readFileSync(p, 'utf8').matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) out.add(m[1]);
      }
    }
  };
  walk(dir);
  return [...out];
}

if (process.argv[1]?.endsWith('i18nKeys.mjs')) {
  const keys = i18nKeys();
  console.log(keys.length);
  console.log(keys.join('\n'));
}
