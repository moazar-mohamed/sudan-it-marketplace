import type { ReactNode } from 'react';

/**
 * What a button says: its label, or while it works a small spinner and what it is
 * doing ("جارٍ الحفظ…"). With no [busyText] the spinner stands in for the label.
 */
export function BusyLabel({ busy, busyText = '', children }: { busy: boolean; busyText?: string; children: ReactNode }) {
  if (!busy) return <>{children}</>;
  return (
    <>
      <span className={`btn-spinner${busyText ? '' : ' alone'}`} aria-hidden="true" />
      {busyText}
    </>
  );
}
