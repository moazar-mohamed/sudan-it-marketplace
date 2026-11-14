import { useEffect, useRef } from 'react';
import type { Notice } from './inbox';

/** The kinds that ring while the panel is open: something a customer is waiting on. */
export const RINGING_TYPES: ReadonlySet<string> = new Set(['new_order', 'new_service_request']);

/**
 * The unread notices that arrived since [seen] (the ids already known), and
 * the ids known now. The first list a page reads is not news: pass null and
 * nothing is new.
 */
export function newArrivals(seen: ReadonlySet<string> | null, notices: readonly Notice[]): { fresh: Notice[]; known: Set<string> } {
  const known = new Set(notices.map((n) => n.id));
  if (seen === null) return { fresh: [], known };
  return { fresh: notices.filter((n) => !n.isRead && !seen.has(n.id)), known };
}

/** A short two-note chime, made here (no sound file); silent where the browser does not allow it yet. */
export function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const audio = new Ctx();
    const now = audio.currentTime;
    [880, 1320].forEach((frequency, i) => {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.3);
      tone.connect(gain).connect(audio.destination);
      tone.start(now + i * 0.18);
      tone.stop(now + i * 0.18 + 0.32);
    });
    window.setTimeout(() => void audio.close().catch(() => undefined), 1000);
  } catch {
    // No sound is no harm.
  }
}

/** Calls [onArrive] with each new unread notice while the panel is open (never for the first list). */
export function useNewArrivals(notices: readonly Notice[] | null, onArrive: (fresh: Notice[]) => void): void {
  const seen = useRef<Set<string> | null>(null);
  const callback = useRef(onArrive);
  callback.current = onArrive;
  useEffect(() => {
    if (notices === null) return;
    const { fresh, known } = newArrivals(seen.current, notices);
    seen.current = known;
    if (fresh.length > 0) callback.current(fresh);
  }, [notices]);
}
