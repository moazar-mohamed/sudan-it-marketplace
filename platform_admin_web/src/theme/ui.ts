import { useSyncExternalStore } from 'react';

/*
 * Which look of the panel is on. The redesign ("v2") is the default; the previous look
 * ("v1") stays one switch away: ?ui=v1 in the address (kept in this browser) or the switch
 * on the design-system page. Everything the stylesheet does for v2 sits under
 * <html data-ui="v2">, so with v1 chosen nothing about the previous panel changes.
 * Density (comfortable / compact) works the same way through data-density.
 */

export type UiVersion = 'v1' | 'v2';
export type Density = 'comfortable' | 'compact';

export const UI_STORAGE_KEY = 'platform_admin_ui';
export const DENSITY_STORAGE_KEY = 'platform_admin_density';

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // localStorage can be unavailable (private mode); use the defaults.
    return null;
  }
}

function writeKey(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // The choice just won't persist.
  }
}

/**
 * Test runs with VITE_FORCE_UI=v2 start every page in the redesign, so the whole suite
 * can prove that each operation of the current pages is still there in the new look.
 */
const forcedUi: UiVersion | null = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_FORCE_UI === 'v2' ? 'v2' : null;

export const readStoredUi = (): UiVersion => forcedUi ?? (readKey(UI_STORAGE_KEY) === 'v1' ? 'v1' : 'v2');
export const readStoredDensity = (): Density => (readKey(DENSITY_STORAGE_KEY) === 'compact' ? 'compact' : 'comfortable');

/** Puts the look on <html>: v1 and "comfortable" leave their attribute off. */
export function applyUi(ui: UiVersion, density: Density): void {
  const root = document.documentElement;
  if (ui === 'v2') root.setAttribute('data-ui', 'v2');
  else root.removeAttribute('data-ui');
  if (density === 'compact') root.setAttribute('data-density', 'compact');
  else root.removeAttribute('data-density');
}

interface UiState {
  ui: UiVersion;
  density: Density;
}

let state: UiState | null = null;
const listeners = new Set<() => void>();

const getSnapshot = (): UiState => (state ??= { ui: readStoredUi(), density: readStoredDensity() });
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function commit(next: UiState): void {
  state = next;
  applyUi(next.ui, next.density);
  listeners.forEach((l) => l());
}

export function setUi(ui: UiVersion): void {
  writeKey(UI_STORAGE_KEY, ui === 'v1' ? 'v1' : null);
  commit({ ...getSnapshot(), ui });
}

export function setDensity(density: Density): void {
  writeKey(DENSITY_STORAGE_KEY, density === 'compact' ? 'compact' : null);
  commit({ ...getSnapshot(), density });
}

/**
 * Applies the saved look when the page starts. An address like ?ui=v2 (or ?ui=v1)
 * is honoured once and then kept, so a link can switch the look on for one person.
 */
export function initUi(search: string = window.location.search): void {
  const asked = new URLSearchParams(search).get('ui');
  if (asked === 'v2' || asked === 'v1') writeKey(UI_STORAGE_KEY, asked === 'v1' ? 'v1' : null);
  state = { ui: readStoredUi(), density: readStoredDensity() };
  applyUi(state.ui, state.density);
}

export function useUi(): { ui: UiVersion; density: Density; setUi: typeof setUi; setDensity: typeof setDensity } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => ({ ui: 'v2', density: 'comfortable' }) as UiState);
  return { ...snapshot, setUi, setDensity };
}
