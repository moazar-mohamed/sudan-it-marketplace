// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyUi,
  DENSITY_STORAGE_KEY,
  initUi,
  readStoredDensity,
  readStoredUi,
  setDensity,
  setUi,
  UI_STORAGE_KEY,
  useUi,
} from './ui';

const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root.removeAttribute('data-ui');
  root.removeAttribute('data-density');
  act(() => {
    setUi('v2');
    setDensity('comfortable');
  });
});
afterEach(cleanup);

// With the redesign forced on for a whole run (npm run test:v2), "the default look" is not what is tested.
const forced = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_FORCE_UI === 'v2';

describe.skipIf(forced)('which look of the panel is on', () => {
  it('is the redesign, comfortable, until someone chooses otherwise', () => {
    expect(readStoredUi()).toBe('v2');
    expect(readStoredDensity()).toBe('comfortable');
    expect(root.getAttribute('data-ui')).toBe('v2');
    expect(root.hasAttribute('data-density')).toBe(false);
  });

  it('the previous look and compact are kept in this browser, and put on <html>', () => {
    act(() => setUi('v1'));
    act(() => setDensity('compact'));
    expect(root.hasAttribute('data-ui')).toBe(false);
    expect(root.getAttribute('data-density')).toBe('compact');
    expect(localStorage.getItem(UI_STORAGE_KEY)).toBe('v1');
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');
  });

  it('going back to the redesign takes the saved choices away', () => {
    act(() => setUi('v1'));
    act(() => setDensity('compact'));
    act(() => setUi('v2'));
    act(() => setDensity('comfortable'));
    expect(root.getAttribute('data-ui')).toBe('v2');
    expect(root.hasAttribute('data-density')).toBe(false);
    expect(localStorage.getItem(UI_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBeNull();
  });

  it('changing one does not change the other', () => {
    act(() => setUi('v2'));
    act(() => setDensity('compact'));
    act(() => setUi('v1'));
    expect(root.getAttribute('data-density')).toBe('compact');
  });

  it('ignores a saved value it does not know', () => {
    localStorage.setItem(UI_STORAGE_KEY, 'v3');
    localStorage.setItem(DENSITY_STORAGE_KEY, 'tiny');
    expect(readStoredUi()).toBe('v2');
    expect(readStoredDensity()).toBe('comfortable');
  });

  it('applies the saved look when the page starts', () => {
    localStorage.setItem(UI_STORAGE_KEY, 'v1');
    initUi('');
    expect(root.hasAttribute('data-ui')).toBe(false);
    localStorage.removeItem(UI_STORAGE_KEY);
    initUi('');
    expect(root.getAttribute('data-ui')).toBe('v2');
  });

  it('?ui=v1 in the address keeps the previous look for this browser; ?ui=v2 brings the redesign back', () => {
    initUi('?ui=v1');
    expect(root.hasAttribute('data-ui')).toBe(false);
    expect(localStorage.getItem(UI_STORAGE_KEY)).toBe('v1');
    initUi('');
    expect(root.hasAttribute('data-ui')).toBe(false);
    initUi('?ui=v2');
    expect(root.getAttribute('data-ui')).toBe('v2');
    expect(localStorage.getItem(UI_STORAGE_KEY)).toBeNull();
  });

  it('an unknown ?ui= value changes nothing', () => {
    localStorage.setItem(UI_STORAGE_KEY, 'v1');
    initUi('?ui=banana');
    expect(root.hasAttribute('data-ui')).toBe(false);
  });

  it('every component using the hook sees a change at once', () => {
    const a = renderHook(() => useUi());
    const b = renderHook(() => useUi());
    act(() => a.result.current.setUi('v1'));
    expect(a.result.current.ui).toBe('v1');
    expect(b.result.current.ui).toBe('v1');
    act(() => b.result.current.setDensity('compact'));
    expect(a.result.current.density).toBe('compact');
  });

  it('applyUi puts the attributes on and takes them off', () => {
    applyUi('v1', 'comfortable');
    expect(root.hasAttribute('data-ui')).toBe(false);
    applyUi('v2', 'compact');
    expect(root.getAttribute('data-ui')).toBe('v2');
    expect(root.getAttribute('data-density')).toBe('compact');
  });
});
