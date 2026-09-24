// @vitest-environment node
/*
 * The design tokens in styles.css :root are the web half of the design system
 * (Figma "03 — Colors"). These tests protect the brand identity and the
 * contrast promises, so a later CSS edit cannot silently break them.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));

const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(root);
  if (!m) throw new Error(`token --${name} is not a hex colour in :root`);
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
