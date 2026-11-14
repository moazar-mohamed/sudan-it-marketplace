import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Resolved = 'light' | 'dark';
type Choice = Resolved | 'system';

interface ThemeValue {
  resolved: Resolved;
  set: (next: Resolved) => void;
}

const KEY = 'technician-portal-theme';
const ThemeContext = createContext<ThemeValue | null>(null);

function readChoice(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Light or dark: the saved choice, else the device's. index.html sets it before the first paint. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Choice>(readChoice);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved: Resolved = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const set = useCallback((next: Resolved) => {
    setChoice(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }, []);

  const value = useMemo(() => ({ resolved, set }), [resolved, set]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme outside ThemeProvider');
  return v;
}
