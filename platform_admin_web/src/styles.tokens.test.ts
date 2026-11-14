// @vitest-environment node
/*
 * The design tokens in styles.css :root are the web half of the design system
 * (Figma "03 — Colors"). These tests protect the brand identity and the
 * contrast promises, so a later CSS edit cannot silently break them. The dark
 * appearance (the mobile app's dark palette) is held to the same promises.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));

const tokenIn = (block: string, name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
  if (!m) throw new Error(`token --${name} is not a hex colour in the block`);
  return m[1].toLowerCase();
};
const token = (name: string): string => tokenIn(root, name);

/** The text between the braces of the block that starts at `opening`. */
const blockAfter = (opening: string): string => {
  const start = css.indexOf(opening);
  if (start < 0) throw new Error(`${opening} is missing from styles.css`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`${opening} is not closed`);
};
const dark = blockAfter(":root[data-theme='dark'] {");
const darkFromDevice = blockAfter(":root:not([data-theme='light']) {");

const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (x: number) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

describe('design tokens (styles.css :root)', () => {
  it('keeps the brand identity', () => {
    expect(token('color-brand-primary')).toBe('#1565c0');
    expect(token('color-brand-secondary')).toBe('#00a8e8');
    expect(token('color-bg-app')).toBe('#f7f9fc');
    expect(token('color-text-primary')).toBe('#172033');
  });

  it('text tokens reach 4.5:1 on the surfaces they are used on', () => {
    const surface = token('color-bg-surface');
    for (const [fg, bg] of [
      ['color-text-primary', 'color-bg-app'],
      ['color-text-secondary', 'color-bg-surface'],
      ['color-text-secondary', 'color-bg-muted'],
      ['color-text-tertiary', 'color-bg-surface'],
      ['color-text-brand', 'color-bg-surface'],
      ['color-text-brand', 'color-brand-primary-subtle'],
      ['color-text-on-primary', 'color-brand-primary'],
      ['color-success-text', 'color-success-subtle'],
      ['color-warning-text', 'color-warning-subtle'],
      ['color-error-text', 'color-error-subtle'],
      ['color-info-text', 'color-info-subtle'],
      ['color-progress-text', 'color-progress-subtle'],
    ]) {
      expect(contrast(token(fg), token(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(token('color-text-primary'), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('control borders and the focus ring reach 3:1', () => {
    const surface = token('color-bg-surface');
    for (const name of ['color-border-input', 'color-border-strong', 'color-border-focus', 'color-border-focus-ring']) {
      expect(contrast(token(name), surface), name).toBeGreaterThanOrEqual(3);
    }
  });

  it('legacy names are aliases of the tokens, not second sources of colour', () => {
    expect(root).toContain('--primary: var(--color-brand-primary)');
    expect(root).toContain('--bg: var(--color-bg-app)');
    expect(root).toContain('--muted: var(--color-text-secondary)');
  });
});

/* ---- dark appearance ---- */

const declarations = (block: string) =>
  block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('--') || l.startsWith('color-scheme'));

const PAIRS = [
  ['color-text-primary', 'color-bg-app'],
  ['color-text-primary', 'color-bg-surface'],
  ['color-text-secondary', 'color-bg-surface'],
  ['color-text-secondary', 'color-bg-muted'],
  ['color-text-tertiary', 'color-bg-surface'],
  ['color-text-brand', 'color-bg-surface'],
  ['color-text-brand', 'color-brand-primary-subtle'],
  ['color-text-on-primary', 'color-brand-primary'],
  ['color-success-text', 'color-success-subtle'],
  ['color-warning-text', 'color-warning-subtle'],
  ['color-error-text', 'color-error-subtle'],
  ['color-info-text', 'color-info-subtle'],
  ['color-progress-text', 'color-progress-subtle'],
  ['color-text-primary', 'color-bg-subtle'],
  ['color-text-secondary', 'color-bg-subtle'],
  ['color-text-primary', 'color-bg-hover'],
];

describe('dark appearance', () => {
  const t = (name: string) => tokenIn(dark, name);

  it('is the same set of values whether it comes from the device or from a choice in Settings', () => {
    expect(declarations(darkFromDevice)).toEqual(declarations(dark));
    expect(declarations(dark).length).toBeGreaterThan(40);
  });

  it('is told to the browser, so form controls and scrollbars go dark too', () => {
    expect(dark).toContain('color-scheme: dark');
    expect(root).toContain('color-scheme: light');
  });

  it('keeps the brand marks exactly as they are', () => {
    expect(t('color-brand-primary')).toBe('#1565c0');
    expect(t('color-brand-secondary')).toBe('#00a8e8');
    expect(t('color-text-on-primary')).toBe('#ffffff');
  });

  it('gives every colour of the light theme a dark value', () => {
    const light = [...root.matchAll(/--(color-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6}|rgba?\()/g)].map((m) => m[1]);
    expect(light.length).toBeGreaterThan(40);
    const missing = light.filter((name) => !new RegExp(`--${name}:`).test(dark));
    expect(missing).toEqual([]);
  });

  it('is a real dark page: dark surfaces, light text', () => {
    expect(luminance(t('color-bg-app'))).toBeLessThan(0.05);
    expect(luminance(t('color-bg-surface'))).toBeLessThan(0.05);
    expect(luminance(t('color-text-primary'))).toBeGreaterThan(0.7);
  });

  it('keeps text readable at 4.5:1 on the surfaces it sits on', () => {
    for (const [fg, bg] of PAIRS) {
      expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps control borders and the focus ring at 3:1', () => {
    for (const name of ['color-border-input', 'color-border-strong', 'color-border-focus', 'color-border-focus-ring']) {
      expect(contrast(t(name), t('color-bg-surface')), name).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps white text readable on the solid fills it is used on, in both themes', () => {
    for (const block of [root, dark]) {
      for (const fill of ['color-success-solid', 'color-danger-solid', 'color-brand-primary']) {
        expect(contrast('#ffffff', tokenIn(block, fill)), fill).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('shows the status dots and the brand text colour clearly against the surface', () => {
    for (const name of ['color-success', 'color-warning', 'color-error', 'color-icon-muted', 'color-text-brand']) {
      expect(contrast(t(name), t('color-bg-surface')), name).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the rest of the stylesheet follows the theme', () => {
  const outsideTokens = css.replace(root, '').replace(dark, '').replace(darkFromDevice, '');

  it('has no light-only surface colours left: backgrounds come from tokens', () => {
    expect(outsideTokens).not.toMatch(/background(-color)?:\s*#(fff|ffffff|fafbfd)\b/i);
    expect(outsideTokens).not.toContain('#fafbfd');
  });
});
