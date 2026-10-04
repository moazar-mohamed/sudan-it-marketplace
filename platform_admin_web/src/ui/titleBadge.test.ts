// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { setBaseTitle, setTitleBadge } from './titleBadge';

beforeEach(() => {
  setTitleBadge(0);
  setBaseTitle('Panel');
});

describe('the tab title', () => {
  it('is the page name, with the number of records needing attention in front', () => {
    expect(document.title).toBe('Panel');
    setTitleBadge(3);
    expect(document.title).toBe('(3) Panel');
    setTitleBadge(0);
    expect(document.title).toBe('Panel');
  });

  it('keeps the number when the language changes the name', () => {
    setTitleBadge(2);
    setBaseTitle('اللوحة');
    expect(document.title).toBe('(2) اللوحة');
  });

  it('never shows a negative or fractional number', () => {
    setTitleBadge(-4);
    expect(document.title).toBe('Panel');
    setTitleBadge(2.9);
    expect(document.title).toBe('(2) Panel');
  });
});
