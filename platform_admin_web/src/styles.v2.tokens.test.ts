// @vitest-environment node
/*
 * The v2 look (styles.v2.css) must keep the brand, keep the contrast promises of
 * the current panel, define every colour token the current stylesheet defines (so
 * no component falls back to the old palette), and apply to nothing unless
 * <html data-ui="v2"> is set. These tests hold it to that.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const v2 = readFileSync(new URL('./styles.v2.css', import.meta.url), 'utf8');
const v2Shell = readFileSync(new URL('./styles.v2.shell.css', import.meta.url), 'utf8');
const v2Components = readFileSync(new URL('./styles.v2.components.css', import.meta.url), 'utf8');
const v1 = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

/** The text between the braces of the block that starts at `opening`. */
const blockAfter = (css: string, opening: string): string => {
  const start = css.indexOf(opening);
  if (start < 0) throw new Error(`${opening} is missing`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`${opening} is not closed`);
};

const lightChosen = blockAfter(v2, ":root[data-ui='v2'][data-theme='light'] {");
const lightDevice = blockAfter(v2, ":root[data-ui='v2']:not([data-theme='dark']) {");
const darkChosen = blockAfter(v2, ":root[data-ui='v2'][data-theme='dark'] {");
const darkDevice = blockAfter(v2, ":root[data-ui='v2']:not([data-theme='light']) {");

const declarations = (block: string) =>
  block
    .split(';')
    .map((d) => d.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const tokenIn = (block: string, name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
  if (!m) throw new Error(`token --${name} is not a hex colour in the block`);
  return m[1].toLowerCase();
};

const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (x: number) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const MODES: [string, string][] = [
  ['light', lightChosen],
  ['dark', darkChosen],
];

describe('v2 colour tokens', () => {
  it('keeps the brand identity in both modes', () => {
    for (const [, block] of MODES) {
      expect(tokenIn(block, 'color-brand-primary')).toBe('#1565c0');
      expect(tokenIn(block, 'color-brand-secondary')).toBe('#00a8e8');
    }
  });

  it('"follow the device" carries exactly the values of the explicit choice', () => {
    expect(declarations(lightDevice)).toEqual(declarations(lightChosen));
    expect(declarations(darkDevice)).toEqual(declarations(darkChosen));
  });

  it('defines every colour token the current stylesheet defines, in both modes', () => {
    const rootBlock = blockAfter(v1, ':root {');
    const names = [...rootBlock.matchAll(/--(color-[a-z-]+):/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(40);
    for (const [mode, block] of MODES) {
      const missing = names.filter((n) => !new RegExp(`--${n}:`).test(block));
      expect(missing, `${mode} block misses ${missing.join(', ')}`).toEqual([]);
    }
  });

  for (const [mode, block] of MODES) {
    const t = (name: string) => tokenIn(block, name);

    it(`${mode}: text reaches 4.5:1 on the surfaces it sits on`, () => {
      for (const [fg, bg] of [
        ['color-text-primary', 'color-bg-app'],
        ['color-text-primary', 'color-bg-surface'],
        ['color-text-secondary', 'color-bg-app'],
        ['color-text-secondary', 'color-bg-surface'],
        ['color-text-secondary', 'color-bg-muted'],
        ['color-text-tertiary', 'color-bg-app'],
        ['color-text-tertiary', 'color-bg-surface'],
        ['color-text-tertiary', 'color-bg-muted'],
        ['color-text-brand', 'color-bg-app'],
        ['color-text-brand', 'color-bg-surface'],
        ['color-text-on-primary', 'color-brand-primary'],
        ['color-error-text', 'color-error-subtle'],
        ['color-success-text', 'color-success-subtle'],
        ['color-warning-text', 'color-warning-subtle'],
        ['color-info-text', 'color-info-subtle'],
        ['color-error-text', 'color-bg-surface'],
        ['color-success-text', 'color-bg-surface'],
        ['color-warning-text', 'color-bg-surface'],
      ]) {
        expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${mode}: field borders and the focus ring reach 3:1 on the surface`, () => {
      expect(contrast(t('color-border-input'), t('color-bg-surface'))).toBeGreaterThanOrEqual(3);
      expect(contrast(t('color-border-focus-ring'), t('color-bg-surface'))).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('v2 stylesheet scope', () => {
  for (const [file, css, least] of [
    ['styles.v2.css', v2, 30],
    ['styles.v2.shell.css', v2Shell, 30],
    ['styles.v2.components.css', v2Components, 30],
  ] as const) {
    it(`${file}: every selector needs <html data-ui="v2">, so the current panel is untouched when it is off`, () => {
      const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
      const selectors = [...noComments.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => !s.startsWith('@'));
      expect(selectors.length).toBeGreaterThan(least);
      for (const list of selectors) {
        for (const sel of list.split(',')) {
          expect(sel.trim(), `selector "${sel.trim()}" is not under data-ui='v2'`).toContain("[data-ui='v2']");
        }
      }
    });
  }

  it('compact density only tightens sizes; it defines no colours', () => {
    const compact = blockAfter(v2, ":root[data-ui='v2'][data-density='compact'] {");
    expect(compact).not.toMatch(/color/);
  });
});
