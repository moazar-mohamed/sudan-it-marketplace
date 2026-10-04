import { useSyncExternalStore } from 'react';

/*
 * Light or dark appearance. By default the panel follows the device (the
 * stylesheet reads prefers-color-scheme, like the mobile app); a choice made in
 * Settings is kept in this browser and sets data-theme on <html>, which the
 * stylesheet puts above the device preference.
 */

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'platform_admin_theme';

export function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage can be unavailable (private mode); follow the device.
  }
  return 'system';
}

/** Puts the choice on <html>: 'system' leaves the attribute off so the device decides. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

let current: ThemePreference | null = null;
const listeners = new Set<() => void>();

const getSnapshot = (): ThemePreference => (current ??= readStoredTheme());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setTheme(preference: ThemePreference): void {
  current = preference;
  applyTheme(preference);
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The choice just won't persist.
  }
  listeners.forEach((l) => l());
}

/** Applies the stored choice; called once before the page is drawn. */
export function initTheme(): void {
  current = readStoredTheme();
  applyTheme(current);
}

export function useTheme(): { theme: ThemePreference; setTheme: (preference: ThemePreference) => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'system' as const);
  return { theme, setTheme };
}
