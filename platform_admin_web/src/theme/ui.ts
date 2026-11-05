import { useSyncExternalStore } from 'react';

/*
 * The panel has one look. Its stylesheet sits under <html data-ui="v2"> (the name the
 * redesign was built under), which index.html and initUi always set. What the person can
 * still choose is the density (comfortable / compact), through data-density.
 */

export type Density = 'comfortable' | 'compact';

export const DENSITY_STORAGE_KEY = 'platform_admin_density';
/** Where the old look's switch was kept; cleared at start so nothing reads it again. */
const OLD_UI_STORAGE_KEY = 'platform_admin_ui';

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

export const readStoredDensity = (): Density => (readKey(DENSITY_STORAGE_KEY) === 'compact' ? 'compact' : 'comfortable');

/** Puts the look on <html>: "comfortable" leaves data-density off. */
export function applyUi(density: Density): void {
  const root = document.documentElement;
  root.setAttribute('data-ui', 'v2');
  if (density === 'compact') root.setAttribute('data-density', 'compact');
  else root.removeAttribute('data-density');
}

interface UiState {
  density: Density;
}

let state: UiState | null = null;
const listeners = new Set<() => void>();

const getSnapshot = (): UiState => (state ??= { density: readStoredDensity() });
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setDensity(density: Density): void {
  writeKey(DENSITY_STORAGE_KEY, density === 'compact' ? 'compact' : null);
  state = { density };
  applyUi(density);
  listeners.forEach((l) => l());
}

/** Applies the saved density when the page starts. */
export function initUi(): void {
  writeKey(OLD_UI_STORAGE_KEY, null);
  state = { density: readStoredDensity() };
  applyUi(state.density);
}

export function useUi(): { density: Density; setDensity: typeof setDensity } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => ({ density: 'comfortable' }) as UiState);
  return { ...snapshot, setDensity };
}
