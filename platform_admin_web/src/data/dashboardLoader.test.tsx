// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSnapshot } from './dashboardTestkit';
import { DASHBOARD_REFRESH_MS, useDashboardLoader } from './dashboardLoader';

const fetchDashboard = vi.hoisted(() => vi.fn());
// Only the network read is replaced; the rest of the module (COUNT_KEYS ...) is real.
vi.mock('./dashboardData', async (importOriginal) => ({ ...(await importOriginal<typeof import('./dashboardData')>()), fetchDashboard }));
vi.mock('../firebase', () => ({ db: {} }));

const setHidden = (hidden: boolean) =>
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
  fetchDashboard.mockReset();
  fetchDashboard.mockImplementation(async (_db: unknown, at: number) => makeSnapshot({ at }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setHidden(false);
});

describe('the dashboard loader', () => {
  it('reads when it opens and then every five minutes while the tab is visible', async () => {
    const { result } = renderHook(() => useDashboardLoader());
    await tick(0);
    expect(fetchDashboard).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot).not.toBeNull();
    await tick(DASHBOARD_REFRESH_MS);
    expect(fetchDashboard).toHaveBeenCalledTimes(2);
    await tick(DASHBOARD_REFRESH_MS);
    expect(fetchDashboard).toHaveBeenCalledTimes(3);
  });

  it('reads nothing while the tab is hidden', async () => {
    renderHook(() => useDashboardLoader());
    await tick(0);
    setHidden(true);
    await tick(DASHBOARD_REFRESH_MS * 6);
    expect(fetchDashboard).toHaveBeenCalledTimes(1);
  });

  it('catches up at once when the tab returns after a long time, not before it is due', async () => {
    renderHook(() => useDashboardLoader());
    await tick(0);
    setHidden(true);
    await tick(DASHBOARD_REFRESH_MS * 3);
    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchDashboard).toHaveBeenCalledTimes(2);

    // Switching tabs back and forth soon after does not read again.
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchDashboard).toHaveBeenCalledTimes(2);
  });

  it('refreshes on demand, and an older slow read never overwrites a newer one', async () => {
    let releaseFirst: (value: ReturnType<typeof makeSnapshot>) => void = () => undefined;
    fetchDashboard.mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }));
    const { result } = renderHook(() => useDashboardLoader());
    await tick(0);
    await act(async () => { void result.current.refresh(); await vi.advanceTimersByTimeAsync(0); });
    const newer = result.current.snapshot;
    expect(newer).not.toBeNull();
    await act(async () => { releaseFirst(makeSnapshot({ at: 1 })); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.snapshot).toBe(newer);
  });

  it('stops everything when it is closed', async () => {
    const { unmount } = renderHook(() => useDashboardLoader());
    await tick(0);
    unmount();
    await tick(DASHBOARD_REFRESH_MS * 3);
    expect(fetchDashboard).toHaveBeenCalledTimes(1);
  });
});
