import { createContext, useContext } from 'react';
import type { DashboardSnapshot } from './dashboardData';

export interface DashboardValue {
  /** null until the first read finishes. */
  snapshot: DashboardSnapshot | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

export const DashboardContext = createContext<DashboardValue | null>(null);

/**
 * The dashboard's figures. One reader (DashboardProvider, mounted by the
 * layout) serves the Dashboard page and the sidebar badges, so they always
 * show the same numbers and the figures are read once, not twice.
 */
export function useDashboard(): DashboardValue {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('useDashboard must be used inside DashboardProvider');
  return value;
}
