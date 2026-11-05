import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** The most products that can be compared side by side. */
export const MAX_COMPARE = 3;
const KEY = 'compare-products';

interface CompareValue {
  ids: string[];
  has: (id: string) => boolean;
  /** Adds or removes [id]; false when it could not be added because the list is full. */
  toggle: (id: string) => boolean;
  remove: (id: string) => void;
  clear: () => void;
  full: boolean;
}

const CompareContext = createContext<CompareValue | null>(null);

function read(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

/**
 * The products picked for comparison, kept on this device until they are cleared.
 * The newest list is also held in a ref, so two presses before a re-render still
 * add both products.
 */
export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(read);
  const latest = useRef(ids);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      // The list just does not survive a reload.
    }
  }, [ids]);

  const commit = useCallback((next: string[]) => {
    latest.current = next;
    setIds(next);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      const now = latest.current;
      if (now.includes(id)) {
        commit(now.filter((x) => x !== id));
        return true;
      }
      if (now.length >= MAX_COMPARE) return false;
      commit([...now, id]);
      return true;
    },
    [commit],
  );

  const value = useMemo<CompareValue>(
    () => ({
      ids,
      has: (id) => ids.includes(id),
      toggle,
      remove: (id) => commit(latest.current.filter((x) => x !== id)),
      clear: () => commit([]),
      full: ids.length >= MAX_COMPARE,
    }),
    [ids, toggle, commit],
  );
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare outside CompareProvider');
  return ctx;
}
