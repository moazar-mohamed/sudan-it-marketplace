import { useMemo, type ReactNode } from 'react';
import { useDashboardLoader } from './dashboardLoader';
import { DashboardContext } from './useDashboard';

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { snapshot, refreshing, refresh } = useDashboardLoader();
  const value = useMemo(() => ({ snapshot, refreshing, refresh }), [snapshot, refreshing, refresh]);
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
