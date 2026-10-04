import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { fetchDashboard, type DashboardSnapshot } from './dashboardData';

/**
 * How often a visible dashboard re-reads its figures. Each read costs a few
 * dozen to a few hundred document reads, and the free plan allows 50,000 a
 * day, so this is deliberately slow and never runs while the tab is hidden.
 */
export const DASHBOARD_REFRESH_MS = 300_000;

/**
 * The dashboard's figures: read when the page opens, every five minutes while
 * the tab is visible, when the tab comes back to the front after that long,
 * and on demand. A tab left open in the background reads nothing. The previous
 * figures stay on screen while a refresh runs.
 */
export function useDashboardLoader() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const alive = useRef(true);
  // A slow refresh must never overwrite a newer one.
  const latest = useRef(0);
  const lastRead = useRef(0);

  const load = useCallback(async () => {
    const run = ++latest.current;
    lastRead.current = Date.now();
    const next = await fetchDashboard(db, lastRead.current);
    if (!alive.current || run !== latest.current) return;
    setSnapshot(next);
    setRefreshing(false);
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    return load();
  }, [load]);

  useEffect(() => {
    alive.current = true;
    void load();

    const refreshIfDue = () => {
      if (document.hidden) return;
      if (Date.now() - lastRead.current >= DASHBOARD_REFRESH_MS) void refresh();
    };
    const timer = setInterval(refreshIfDue, DASHBOARD_REFRESH_MS);
    // Back in front after a long time away: catch up at once, not at the next tick.
    document.addEventListener('visibilitychange', refreshIfDue);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfDue);
    };
  }, [load, refresh]);

  return { snapshot, refreshing, refresh };
}
