import { describe, expect, it } from 'vitest';
import { pageTitle, withCountOf } from './pageTitle';
import { titleWithCount } from './titleCount';

describe('pageTitle', () => {
  it('names the page before the site', () => {
    expect(pageTitle('المنتجات والخدمات')).toBe('المنتجات والخدمات | سوق السودان للتقنية');
  });

  it('is the site name alone without a page', () => {
    expect(pageTitle(null)).toBe('سوق السودان للتقنية');
    expect(pageTitle(undefined)).toBe('سوق السودان للتقنية');
    expect(pageTitle('  ')).toBe('سوق السودان للتقنية');
  });
});

describe('withCountOf', () => {
  it('keeps the waiting count the header shows', () => {
    expect(withCountOf('(3) طلباتي | سوق', 'المفضلة | سوق')).toBe('(3) المفضلة | سوق');
    expect(withCountOf('(99+) x', 'y')).toBe('(99+) y');
    expect(withCountOf('طلباتي | سوق', 'المفضلة | سوق')).toBe('المفضلة | سوق');
  });

  it('works with the header count helper both ways', () => {
    const titled = withCountOf(titleWithCount('a', 2), pageTitle('الشركات'));
    expect(titled).toBe('(2) الشركات | سوق السودان للتقنية');
    expect(titleWithCount(titled, 0)).toBe('الشركات | سوق السودان للتقنية');
  });
});
