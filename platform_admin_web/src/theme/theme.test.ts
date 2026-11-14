// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, initTheme, readStoredTheme, setTheme, THEME_STORAGE_KEY, useTheme } from './theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  act(() => setTheme('system'));
});
afterEach(cleanup);

describe('light / dark appearance', () => {
  it('follows the device until a choice is made', () => {
    expect(readStoredTheme()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('an explicit choice is put on <html> and kept in this browser', () => {
    act(() => setTheme('dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    act(() => setTheme('light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(readStoredTheme()).toBe('light');
  });

  it('"same as the device" takes the attribute and the saved choice away again', () => {
    act(() => setTheme('dark'));
    act(() => setTheme('system'));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('ignores a saved value that is not a known choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readStoredTheme()).toBe('system');
  });

  it('applies the saved choice when the page starts', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('every component using the hook sees a change at once', () => {
    const a = renderHook(() => useTheme());
    const b = renderHook(() => useTheme());
    act(() => a.result.current.setTheme('dark'));
    expect(a.result.current.theme).toBe('dark');
    expect(b.result.current.theme).toBe('dark');
  });
});
