import { useEffect, useState } from 'react';

/**
 * The current time as state, refreshed every minute, so the "older than 24
 * hours" rules keep moving while a page stays open and render stays pure.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
