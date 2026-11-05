// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyUi, DENSITY_STORAGE_KEY, initUi, readStoredDensity, setDensity, useUi } from './ui';

const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root.removeAttribute('data-ui');
  root.removeAttribute('data-density');
  act(() => setDensity('comfortable'));
});
afterEach(cleanup);

describe('the look of the panel', () => {
  it('is the one look, comfortable, until someone chooses compact', () => {
    expect(readStoredDensity()).toBe('comfortable');
    expect(root.getAttribute('data-ui')).toBe('v2');
    expect(root.hasAttribute('data-density')).toBe(false);
  });

  it('compact is kept in this browser and put on <html>; comfortable takes it away', () => {
    act(() => setDensity('compact'));
    expect(root.getAttribute('data-density')).toBe('compact');
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');
    act(() => setDensity('comfortable'));
    expect(root.hasAttribute('data-density')).toBe(false);
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBeNull();
  });

  it('ignores a saved density it does not know', () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'tiny');
    expect(readStoredDensity()).toBe('comfortable');
  });

  it('applies the saved density when the page starts, and always the one look', () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'compact');
    initUi();
    expect(root.getAttribute('data-ui')).toBe('v2');
    expect(root.getAttribute('data-density')).toBe('compact');
  });

  it('forgets the switch the previous look was kept under, so nothing can bring it back', () => {
    localStorage.setItem('platform_admin_ui', 'v1');
    initUi();
    expect(localStorage.getItem('platform_admin_ui')).toBeNull();
    expect(root.getAttribute('data-ui')).toBe('v2');
  });

  it('every component using the hook sees a change at once', () => {
    const a = renderHook(() => useUi());
    const b = renderHook(() => useUi());
    act(() => a.result.current.setDensity('compact'));
    expect(a.result.current.density).toBe('compact');
    expect(b.result.current.density).toBe('compact');
  });

  it('applyUi puts the density on and takes it off, and keeps the look on', () => {
    applyUi('compact');
    expect(root.getAttribute('data-ui')).toBe('v2');
    expect(root.getAttribute('data-density')).toBe('compact');
    applyUi('comfortable');
    expect(root.getAttribute('data-ui')).toBe('v2');
    expect(root.hasAttribute('data-density')).toBe(false);
  });
});
