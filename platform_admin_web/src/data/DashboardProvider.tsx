import { useMemo, type ReactNode } from 'react';
import { useDashboardLoader } from './dashboardLoader';
import { DashboardContext } from './useDashboard';

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { snapshot, refreshing, refresh, refreshIfStale } = useDashboardLoader();
  const value = useMemo(() => ({ snapshot, refreshing, refresh, refreshIfStale }), [snapshot, refreshing, refresh, refreshIfStale]);
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
