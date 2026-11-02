import { useSyncExternalStore } from 'react';

// "Try again" reconnects what failed to load, without reloading the page and
// losing what the customer typed. A load that failed has stopped listening, so
// each one starts again when this number moves.
let attempt = 0;
const listeners = new Set<() => void>();

export function retryLoads(): void {
  attempt += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useRetryKey = (): number => useSyncExternalStore(subscribe, () => attempt);
