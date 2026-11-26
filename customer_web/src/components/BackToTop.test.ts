import { describe, expect, it } from 'vitest';
import { hasBackToTop, nextVisible } from './BackToTop';

describe('hasBackToTop', () => {
  it.each(['/', '/browse', '/browse?kind=services', '/category/c1', '/search', '/companies', '/company/c1', '/product/p1', '/terms'])(
    'the long page %s has it',
    (path) => expect(hasBackToTop(path.split('?')[0])).toBe(true),
  );

  it.each(['/orders', '/notifications', '/favorites', '/reports', '/chats', '/chats/x', '/checkout/p1', '/login', '/join-company'])(
    '%s has not',
    (path) => expect(hasBackToTop(path)).toBe(false),
  );
});

describe('nextVisible', () => {
  const vh = 800;
  const max = 8000;
  it('stays hidden in the first screen and a half', () => {
    expect(nextVisible(true, 1100, 1300, vh, max)).toBe(false);
  });
  it('hides on the way down and shows on the way up', () => {
    expect(nextVisible(true, 3000, 2900, vh, max)).toBe(false);
    expect(nextVisible(false, 2900, 3000, vh, max)).toBe(true);
  });
  it('a tiny move keeps what it was', () => {
    expect(nextVisible(true, 3002, 3000, vh, max)).toBe(true);
    expect(nextVisible(false, 3002, 3000, vh, max)).toBe(false);
  });
  it('shows near the end of the page even while going down', () => {
    expect(nextVisible(false, 7800, 7700, vh, max)).toBe(true);
  });
});
